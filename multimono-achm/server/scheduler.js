'use strict';
const { db } = require('./db');
const notifyLib = require('./notify');
const { flushOutbox } = require('./mailer');
const { cleanupSessions } = require('./auth');
const { HOUR, todayLocal, licenseStatus } = require('./time');

/**
 * Rappel envoyé exactement 24 h avant le début de la séance
 * (vérification chaque minute). Pas de rappel pour une réservation
 * faite moins de 24 h avant : la confirmation en tient lieu.
 */
function sendReminders(now = new Date()) {
  const limit = new Date(now.getTime() + 24 * HOUR).toISOString();
  const due = db.prepare(`
    SELECT b.id AS booking_id, s.*, u.id AS uid
    FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN users u ON u.id = b.user_id
    WHERE b.status = 'booked' AND b.reminder_sent_at IS NULL
      AND s.starts_at <= ? AND s.starts_at > ?`).all(limit, now.toISOString());
  const mark = db.prepare('UPDATE bookings SET reminder_sent_at = ? WHERE id = ?');
  let sent = 0;
  for (const row of due) {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.booking_id);
    const bookedLate = new Date(row.starts_at) - new Date(booking.created_at) < 24 * HOUR;
    mark.run(bookedLate ? 'skipped' : now.toISOString(), row.booking_id);
    if (bookedLate) continue;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.uid);
    notifyLib.reminder(user, row, booking);
    sent++;
  }
  return sent;
}

/** Alertes de licence : 30 jours puis 7 jours avant l'expiration (une seule fois chacune) */
function sendLicenseAlerts(today = todayLocal()) {
  const members = db.prepare("SELECT * FROM users WHERE role = 'member' AND license_expires IS NOT NULL").all();
  const already = db.prepare('SELECT 1 FROM license_alerts WHERE user_id = ? AND expires = ? AND kind = ?');
  const record = db.prepare('INSERT INTO license_alerts (user_id, expires, kind, sent_at) VALUES (?, ?, ?, ?)');
  let sent = 0;
  for (const u of members) {
    const { daysLeft } = licenseStatus(u.license_expires, today);
    if (daysLeft === null || daysLeft < 0 || daysLeft > 30) continue;
    const kind = daysLeft <= 7 ? '7' : '30';
    if (already.get(u.id, u.license_expires, kind)) continue;
    record.run(u.id, u.license_expires, kind, new Date().toISOString());
    // si on passe directement sous 7 jours, inutile d'envoyer aussi l'alerte 30 jours
    if (kind === '7' && !already.get(u.id, u.license_expires, '30')) record.run(u.id, u.license_expires, '30', new Date().toISOString());
    notifyLib.licenseAlert(u, daysLeft, u.license_expires);
    sent++;
  }
  return sent;
}

function tick() {
  try {
    sendReminders();
    sendLicenseAlerts();
    flushOutbox();
  } catch (err) {
    console.error('Erreur planificateur', err);
  }
}

function start() {
  tick();
  const t1 = setInterval(tick, 60 * 1000);
  const t2 = setInterval(cleanupSessions, 6 * HOUR);
  t1.unref(); t2.unref();
}

module.exports = { start, sendReminders, sendLicenseAlerts };
