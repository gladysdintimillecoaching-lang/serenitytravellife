'use strict';
const config = require('./config');
const { db, getSettings, takenSql } = require('./db');
const notifyLib = require('./notify');
const { HOUR, utcToLocal, licenseStatus, fmtSlot } = require('./time');

class AppError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

const slotStmt = db.prepare('SELECT * FROM slots WHERE id = ?');
const takenStmt = db.prepare(`SELECT ${takenSql('s')} n FROM slots s WHERE s.id = ?`);
const levelStmt = db.prepare('SELECT * FROM levels WHERE id = ?');

/**
 * Réserve une place (transaction immédiate : pas de surréservation possible).
 * byAdmin : inscription faite par le gérant (pas de contrôle de licence/niveau, il décide).
 */
const bookTx = db.transaction((user, slotId, byAdmin = false) => {
  const slot = slotStmt.get(slotId);
  if (!slot) throw new AppError(404, 'Cette séance n\'existe plus.');
  if (new Date(slot.starts_at) <= new Date()) throw new AppError(400, 'Cette séance a déjà commencé.');
  if (!byAdmin) checkEligibility(user, slot);
  if (db.prepare("SELECT 1 FROM bookings WHERE slot_id = ? AND user_id = ? AND status = 'booked'").get(slotId, user.id)) {
    throw new AppError(409, byAdmin ? 'Ce membre est déjà inscrit à cette séance.' : 'Vous êtes déjà inscrit(e) à cette séance.');
  }
  if (takenStmt.get(slotId).n >= slot.capacity) throw new AppError(409, 'Désolé, cette séance est complète.', { code: 'full' });

  const info = db.prepare('INSERT INTO bookings (slot_id, user_id) VALUES (?, ?)').run(slotId, user.id);
  return { slot, booking: { id: Number(info.lastInsertRowid) } };
});

function checkEligibility(user, slot) {
  const sessionDay = utcToLocal(slot.starts_at).date;
  const lic = licenseStatus(user.license_expires, sessionDay);
  if (lic.status === 'missing') {
    throw new AppError(403, 'Aucune licence enregistrée. Ajoutez votre numéro et la date d\'expiration de votre licence dans votre profil pour pouvoir réserver.', { code: 'license' });
  }
  if (lic.status === 'expired') {
    throw new AppError(403, 'Votre licence ne sera plus valide à la date de cette séance. Pour des raisons d\'assurance, la réservation est bloquée : renouvelez votre licence puis mettez à jour votre profil.', { code: 'license' });
  }

  if (getSettings().enforce_level === '1' && slot.level_id) {
    const required = levelStmt.get(slot.level_id);
    const mine = user.level_id ? levelStmt.get(user.level_id) : null;
    if (required && (!mine || mine.sort_order < required.sort_order)) {
      throw new AppError(403, `Cette séance demande le niveau « ${required.name} » minimum.`, { code: 'level' });
    }
  }
}

function book(user, slotId, { byAdmin = false } = {}) {
  const { slot, booking } = bookTx.immediate(user, slotId, byAdmin);
  notifyLib.bookingConfirmed(user, slot, booking);
  return booking;
}

/** Le gérant ajoute un invité / un groupe (plusieurs places) */
const addGuest = db.transaction((slotId, { name, places, phone, note }) => {
  const slot = slotStmt.get(slotId);
  if (!slot) throw new AppError(404, 'Séance introuvable.');
  const free = slot.capacity - takenStmt.get(slotId).n;
  if (places > free) throw new AppError(409, free > 0 ? `Il ne reste que ${free} place${free > 1 ? 's' : ''} sur cette séance.` : 'Cette séance est complète.');
  return Number(db.prepare('INSERT INTO slot_guests (slot_id, name, places, phone, note) VALUES (?, ?, ?, ?, ?)')
    .run(slotId, name, places, phone, note).lastInsertRowid);
});

/** Le gérant retire un participant : pas de pénalité, le membre est prévenu */
function removeByAdmin(bookingId) {
  const b = db.prepare("SELECT * FROM bookings WHERE id = ? AND status = 'booked'").get(bookingId);
  if (!b) throw new AppError(404, 'Réservation introuvable.');
  db.prepare("UPDATE bookings SET status = 'slot_cancelled', cancelled_at = ? WHERE id = ?").run(new Date().toISOString(), b.id);
  const slot = slotStmt.get(b.slot_id);
  if (new Date(slot.starts_at) > new Date()) notifyLib.removedByAdmin(db.prepare('SELECT * FROM users WHERE id = ?').get(b.user_id), slot);
}

/**
 * Annule une réservation.
 * - opts.force : l'utilisateur a confirmé l'annulation tardive
 * Une annulation faite peu après le rappel H-24 (marge de grâce) n'est pas tardive :
 * le rappel annonce « dernière limite », l'utilisateur doit pouvoir y répondre.
 * Retourne { late, needsConfirm } ; needsConfirm = true si tardive non confirmée.
 */
function cancel(user, bookingId, opts = {}) {
  const b = db.prepare(`SELECT b.*, s.starts_at, s.ends_at, s.level_id, s.location FROM bookings b
                        JOIN slots s ON s.id = b.slot_id WHERE b.id = ?`).get(bookingId);
  if (!b || b.user_id !== user.id) throw new AppError(404, 'Réservation introuvable.');
  if (b.status !== 'booked') throw new AppError(409, 'Cette réservation est déjà annulée.');
  const now = Date.now();
  const start = new Date(b.starts_at).getTime();
  if (start <= now) throw new AppError(400, 'La séance a déjà commencé, l\'annulation n\'est plus possible.');

  const hoursBefore = (start - now) / HOUR;
  const reminderAt = Date.parse(b.reminder_sent_at);
  const inGrace = !Number.isNaN(reminderAt) && now - reminderAt <= config.reminderGraceMinutes * 60000;
  const late = hoursBefore < config.cancelLimitHours && !inGrace;
  if (late && !opts.force) return { late: true, needsConfirm: true, hoursBefore };

  const nowIso = new Date(now).toISOString();
  const member = db.prepare('SELECT * FROM users WHERE id = ?').get(b.user_id);
  db.transaction(() => {
    db.prepare('UPDATE bookings SET status = ?, cancelled_at = ? WHERE id = ?').run(late ? 'late_cancelled' : 'cancelled', nowIso, b.id);
    if (late) {
      db.prepare(`INSERT INTO late_cancellations (user_id, user_name, slot_id, slot_starts_at, slot_label, hours_before, cancelled_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(member.id, `${member.first_name} ${member.last_name}`, b.slot_id, b.starts_at, fmtSlot(b), hoursBefore, nowIso);
    }
  })();
  if (late) notifyLib.lateCancellation(member, slotStmt.get(b.slot_id), hoursBefore);
  return { late, needsConfirm: false, hoursBefore };
}

function confirmPresence(user, bookingId) {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!b || b.user_id !== user.id) throw new AppError(404, 'Réservation introuvable.');
  if (b.status !== 'booked') throw new AppError(409, 'Cette réservation a été annulée.');
  db.prepare('UPDATE bookings SET presence_confirmed_at = COALESCE(presence_confirmed_at, ?) WHERE id = ?').run(new Date().toISOString(), b.id);
}

module.exports = { AppError, book, cancel, confirmPresence, addGuest: (id, g) => addGuest.immediate(id, g), removeByAdmin };
