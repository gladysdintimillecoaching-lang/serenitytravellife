'use strict';
const crypto = require('crypto');
const express = require('express');
const config = require('./config');
const { db, getSettings, setSetting, takenSql } = require('./db');
const auth = require('./auth');
const notifyLib = require('./notify');
const { AppError, book, cancel, confirmPresence, addGuest, removeByAdmin } = require('./bookings');
const { localToUtc, utcToLocal, todayLocal, addDays, weekdayIndex, licenseStatus, fmtDate, fmtTime } = require('./time');

const router = express.Router();
const wrap = (fn) => (req, res, next) => { try { const r = fn(req, res, next); if (r && r.catch) r.catch(next); } catch (e) { next(e); } };

// ───────────── Validation ─────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v, field, { required = true, max = 200 } = {}) {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (required && !s) throw new AppError(400, `Le champ « ${field} » est obligatoire.`);
  if (s.length > max) throw new AppError(400, `Le champ « ${field} » est trop long.`);
  return s || null;
}
function date(v, field, opts) {
  const s = str(v, field, opts);
  if (s && (!DATE_RE.test(s) || Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()))) throw new AppError(400, `Date invalide : ${field}.`);
  return s;
}
function time(v, field) {
  const s = str(v, field);
  if (!TIME_RE.test(s)) throw new AppError(400, `Heure invalide : ${field}.`);
  return s;
}
function int(v, field, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError(400, `Valeur invalide : ${field}.`);
  return n;
}
function levelId(v) {
  if (v === '' || v == null) return null;
  const id = Number(v);
  if (!db.prepare('SELECT 1 FROM levels WHERE id = ?').get(id)) throw new AppError(400, 'Niveau inconnu.');
  return id;
}
function password(v) {
  const s = typeof v === 'string' ? v : '';
  if (s.length < 8) throw new AppError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
  if (s.length > 200) throw new AppError(400, 'Mot de passe trop long.');
  return s;
}

// ───────────── Sérialisation ─────────────
const levelsAll = () => db.prepare('SELECT * FROM levels ORDER BY sort_order, id').all();

function publicUser(u) {
  if (!u) return null;
  const lic = licenseStatus(u.license_expires);
  const level = u.level_id ? db.prepare('SELECT * FROM levels WHERE id = ?').get(u.level_id) : null;
  return {
    id: u.id, role: u.role, login: u.login, email: u.email, firstName: u.first_name, lastName: u.last_name,
    birthDate: u.birth_date, phone: u.phone, emergencyName: u.emergency_name, emergencyPhone: u.emergency_phone,
    licenseNumber: u.license_number, licenseObtained: u.license_obtained, licenseExpires: u.license_expires,
    license: lic, level, rulesAcceptedAt: u.rules_accepted_at, createdAt: u.created_at,
  };
}

function slotRows(where, params, userId) {
  return db.prepare(`
    SELECT s.*, l.name AS level_name, l.color AS level_color,
      ${takenSql('s')} AS booked,
      (SELECT b.id FROM bookings b WHERE b.slot_id = s.id AND b.status = 'booked' AND b.user_id = ?) AS my_booking_id
    FROM slots s LEFT JOIN levels l ON l.id = s.level_id
    WHERE ${where} ORDER BY s.starts_at`).all(userId || 0, ...params)
    .map(serializeSlot);
}

function serializeSlot(s) {
  const start = utcToLocal(s.starts_at);
  const end = utcToLocal(s.ends_at);
  return {
    id: s.id, startsAt: s.starts_at, endsAt: s.ends_at, date: start.date, start: start.time, end: end.time,
    capacity: s.capacity, booked: s.booked, remaining: Math.max(0, s.capacity - s.booked), full: s.booked >= s.capacity,
    level: s.level_id ? { id: s.level_id, name: s.level_name, color: s.level_color } : null,
    location: s.location, notes: s.notes, seriesId: s.series_id,
    myBookingId: s.my_booking_id || null, past: new Date(s.starts_at) <= new Date(),
  };
}

// ───────────── Public ─────────────
router.get('/public/config', (_req, res) => {
  const s = getSettings();
  res.json({
    clubName: s.club_name, rules: s.rules_text, licenseRenewUrl: s.license_renew_url, defaultLocation: s.default_location,
    enforceLevel: s.enforce_level === '1', levels: levelsAll(), today: todayLocal(),
    cancelLimitHours: config.cancelLimitHours,
  });
});

// ───────────── Authentification ─────────────
const loginLimiter = auth.rateLimit({ windowMs: 15 * 60000, max: 20 });

router.post('/auth/register', loginLimiter, wrap((req, res) => {
  const b = req.body || {};
  const email = str(b.email, 'Email', { max: 160 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new AppError(400, 'Adresse email invalide.');
  if (!b.acceptRules) throw new AppError(400, 'Vous devez accepter le règlement du club.');
  const data = {
    firstName: str(b.firstName, 'Prénom', { max: 80 }), lastName: str(b.lastName, 'Nom', { max: 80 }),
    birthDate: date(b.birthDate, 'Date de naissance'), phone: str(b.phone, 'Téléphone', { max: 30 }),
    emergencyName: str(b.emergencyName, 'Contact d\'urgence (nom)', { max: 120 }),
    emergencyPhone: str(b.emergencyPhone, 'Contact d\'urgence (téléphone)', { max: 30 }),
    licenseNumber: str(b.licenseNumber, 'Numéro de licence', { max: 40 }),
    licenseObtained: date(b.licenseObtained, 'Date d\'obtention'), licenseExpires: date(b.licenseExpires, 'Date d\'expiration'),
    levelId: levelId(b.levelId),
  };
  if (data.licenseExpires < data.licenseObtained) throw new AppError(400, 'La date d\'expiration doit être postérieure à la date d\'obtention.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new AppError(409, 'Un compte existe déjà avec cet email. Connectez-vous ou utilisez « Mot de passe oublié ».');
  const info = db.prepare(`INSERT INTO users (role, email, password_hash, first_name, last_name, birth_date, phone, emergency_name,
      emergency_phone, license_number, license_obtained, license_expires, level_id, rules_accepted_at)
      VALUES ('member', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(email, auth.hashPassword(password(b.password)), data.firstName, data.lastName, data.birthDate, data.phone,
      data.emergencyName, data.emergencyPhone, data.licenseNumber, data.licenseObtained, data.licenseExpires, data.levelId,
      new Date().toISOString());
  const { token, expires } = auth.createSession(Number(info.lastInsertRowid));
  auth.setSessionCookie(res, token, expires);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  notifyLib.notify(user, { type: 'welcome', title: `Bienvenue à bord, ${user.first_name} ! ⛵`, body: 'Votre carte d\'inscription est enregistrée. Vous pouvez maintenant réserver vos séances de multimono.' });
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/auth/login', loginLimiter, wrap((req, res) => {
  const login = String(req.body?.login || '').trim().toLowerCase();
  const pwd = String(req.body?.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ? OR login = ?').get(login, login);
  if (!user || !auth.verifyPassword(pwd, user.password_hash)) throw new AppError(401, 'Identifiant ou mot de passe incorrect.');
  const { token, expires } = auth.createSession(user.id);
  auth.setSessionCookie(res, token, expires);
  res.json({ user: publicUser(user) });
}));

router.post('/auth/logout', (req, res) => {
  auth.destroySession(req.sessionToken);
  res.clearCookie(auth.COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.post('/auth/forgot', loginLimiter, wrap((req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (user) {
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(auth.sha256(token), user.id, new Date(Date.now() + 3600000).toISOString());
    notifyLib.passwordReset(user, token);
  }
  // Réponse identique dans tous les cas (ne révèle pas les comptes existants)
  res.json({ ok: true });
}));

router.post('/auth/reset', loginLimiter, wrap((req, res) => {
  const row = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND expires_at > ?')
    .get(auth.sha256(String(req.body?.token || '')), new Date().toISOString());
  if (!row) throw new AppError(400, 'Ce lien n\'est plus valide. Refaites une demande.');
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(password(req.body.password)), row.user_id);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  })();
  res.json({ ok: true });
}));

// ───────────── Liens des emails (sans connexion) ─────────────
function emailActionContext(token) {
  const p = auth.verifyToken(token);
  if (!p) throw new AppError(400, 'Ce lien a expiré ou n\'est pas valide. Ouvrez l\'application pour gérer votre réservation.');
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(p.b);
  if (!b) throw new AppError(404, 'Réservation introuvable.');
  const slot = slotRows('s.id = ?', [b.slot_id], b.user_id)[0];
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(b.user_id);
  return { p, b, slot, user };
}

router.post('/email-action/info', wrap((req, res) => {
  const { p, b, slot } = emailActionContext(req.body?.token);
  res.json({ action: p.a, status: b.status, presenceConfirmed: Boolean(b.presence_confirmed_at), slot });
}));

router.post('/email-action', wrap((req, res) => {
  const { p, b, user } = emailActionContext(req.body?.token);
  if (p.a === 'confirm') {
    confirmPresence(user, b.id);
    return res.json({ ok: true, confirmed: true });
  }
  const result = cancel(user, b.id, { force: Boolean(req.body?.force) });
  res.json(result);
}));

// ───────────── Espace participant ─────────────
router.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));

router.put('/me', auth.requireAuth, wrap((req, res) => {
  const b = req.body || {};
  const u = req.user;
  if (u.role === 'admin') {
    const email = str(b.email, 'Email', { max: 160 }).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new AppError(400, 'Adresse email invalide.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, u.id)) throw new AppError(409, 'Email déjà utilisé.');
    db.prepare('UPDATE users SET first_name = ?, email = ?, phone = ? WHERE id = ?')
      .run(str(b.firstName, 'Prénom', { max: 80 }), email, str(b.phone, 'Téléphone', { required: false, max: 30 }), u.id);
  } else {
    const email = str(b.email, 'Email', { max: 160 }).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new AppError(400, 'Adresse email invalide.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, u.id)) throw new AppError(409, 'Email déjà utilisé par un autre compte.');
    const obtained = date(b.licenseObtained, 'Date d\'obtention');
    const expires = date(b.licenseExpires, 'Date d\'expiration');
    if (expires < obtained) throw new AppError(400, 'La date d\'expiration doit être postérieure à la date d\'obtention.');
    db.prepare(`UPDATE users SET first_name = ?, last_name = ?, birth_date = ?, phone = ?, email = ?, emergency_name = ?,
        emergency_phone = ?, license_number = ?, license_obtained = ?, license_expires = ?, level_id = ? WHERE id = ?`)
      .run(str(b.firstName, 'Prénom', { max: 80 }), str(b.lastName, 'Nom', { max: 80 }), date(b.birthDate, 'Date de naissance'),
        str(b.phone, 'Téléphone', { max: 30 }), email, str(b.emergencyName, 'Contact d\'urgence (nom)', { max: 120 }),
        str(b.emergencyPhone, 'Contact d\'urgence (téléphone)', { max: 30 }), str(b.licenseNumber, 'Numéro de licence', { max: 40 }),
        obtained, expires, levelId(b.levelId), u.id);
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)) });
}));

router.put('/me/password', auth.requireAuth, wrap((req, res) => {
  if (!auth.verifyPassword(String(req.body?.current || ''), req.user.password_hash)) throw new AppError(400, 'Mot de passe actuel incorrect.');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(auth.hashPassword(password(req.body.next)), req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(req.user.id, auth.sha256(req.sessionToken));
  res.json({ ok: true });
}));

router.get('/slots', auth.requireAuth, wrap((req, res) => {
  const from = date(req.query.from || todayLocal(), 'from');
  const to = date(req.query.to || addDays(from, 7), 'to');
  const slots = slotRows('s.starts_at >= ? AND s.starts_at < ?', [localToUtc(from, '00:00'), localToUtc(addDays(to, 1), '00:00')], req.user.id);
  res.json({ slots });
}));

router.post('/slots/:id/book', auth.requireAuth, wrap((req, res) => {
  if (req.user.role === 'admin') throw new AppError(400, 'Le compte gérant ne peut pas réserver.');
  const booking = book(req.user, Number(req.params.id));
  res.status(201).json({ bookingId: booking.id, slot: slotRows('s.id = ?', [Number(req.params.id)], req.user.id)[0] });
}));

router.get('/me/bookings', auth.requireAuth, wrap((req, res) => {
  const rows = db.prepare(`
    SELECT b.id AS booking_id, b.status, b.presence_confirmed_at, b.cancelled_at, s.*, l.name AS level_name, l.color AS level_color,
      ${takenSql('s')} AS booked
    FROM bookings b JOIN slots s ON s.id = b.slot_id LEFT JOIN levels l ON l.id = s.level_id
    WHERE b.user_id = ? AND s.ends_at > ? ORDER BY s.starts_at`).all(req.user.id, new Date().toISOString());
  const upcoming = rows.filter((r) => r.status === 'booked').map((r) => ({
    bookingId: r.booking_id, presenceConfirmed: Boolean(r.presence_confirmed_at), slot: serializeSlot({ ...r, my_booking_id: r.booking_id }),
  }));
  res.json({ upcoming });
}));

router.post('/bookings/:id/cancel', auth.requireAuth, wrap((req, res) => {
  res.json(cancel(req.user, Number(req.params.id), { force: Boolean(req.body?.force) }));
}));

router.post('/bookings/:id/confirm', auth.requireAuth, wrap((req, res) => {
  confirmPresence(req.user, Number(req.params.id));
  res.json({ ok: true });
}));

router.get('/notifications', auth.requireAuth, (req, res) => {
  const items = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id)
    .map((n) => ({ ...n, data: n.data ? JSON.parse(n.data) : null }));
  const unread = db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.user.id).n;
  res.json({ items, unread });
});

router.post('/notifications/read', auth.requireAuth, (req, res) => {
  const now = new Date().toISOString();
  if (req.body?.id) db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?').run(now, Number(req.body.id), req.user.id);
  else db.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(now, req.user.id);
  res.json({ ok: true });
});

// ───────────── Espace gérant ─────────────
const admin = express.Router();
admin.use(auth.requireAdmin);

admin.get('/dashboard', wrap((_req, res) => {
  const today = todayLocal();
  const monday = addDays(today, -weekdayIndex(today));
  const range = (a, b) => [localToUtc(a, '00:00'), localToUtc(b, '00:00')];
  const todaySlots = slotRows('s.starts_at >= ? AND s.starts_at < ?', range(today, addDays(today, 1)));
  const weekSlots = slotRows('s.starts_at >= ? AND s.starts_at < ?', range(monday, addDays(monday, 7)));
  const cap = weekSlots.reduce((a, s) => a + s.capacity, 0);
  const booked = weekSlots.reduce((a, s) => a + s.booked, 0);
  const expiring = db.prepare(`SELECT * FROM users WHERE role = 'member' AND license_expires IS NOT NULL AND license_expires <= ?
                               ORDER BY license_expires`).all(addDays(today, 30)).map(publicUser);
  const lateCount = db.prepare('SELECT COUNT(*) n FROM late_cancellations WHERE cancelled_at >= ?').get(new Date(Date.now() - 30 * 86400000).toISOString()).n;
  const members = db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'member'").get().n;
  res.json({ today, weekStart: monday, todaySlots, weekSlots, fillRate: cap ? Math.round((booked / cap) * 100) : 0, weekBooked: booked, weekCapacity: cap, expiring, lateCount, members });
}));

function readSlotInput(b) {
  const start = time(b.start, 'Heure de début');
  const end = time(b.end, 'Heure de fin');
  if (end <= start) throw new AppError(400, 'L\'heure de fin doit être après l\'heure de début.');
  return {
    start, end, capacity: int(b.capacity, 'Nombre de places', 1, 500), levelId: levelId(b.levelId),
    location: str(b.location, 'Lieu', { required: false, max: 160 }), notes: str(b.notes, 'Remarques', { required: false, max: 500 }),
  };
}

admin.post('/slots', wrap((req, res) => {
  const b = req.body || {};
  const s = readSlotInput(b);
  let dates = [];
  if (b.recurring) {
    const from = date(b.from, 'Date de début'); const until = date(b.until, 'Date de fin');
    const days = Array.isArray(b.weekdays) ? b.weekdays.map(Number).filter((d) => d >= 0 && d <= 6) : [];
    if (!days.length) throw new AppError(400, 'Choisissez au moins un jour de pratique.');
    if (until < from) throw new AppError(400, 'La date de fin doit être après la date de début.');
    for (let d = from; d <= until; d = addDays(d, 1)) if (days.includes(weekdayIndex(d))) dates.push(d);
    if (dates.length > 400) throw new AppError(400, 'Trop de séances d\'un coup (400 max). Réduisez la période.');
  } else {
    dates = [date(b.date, 'Date')];
  }
  if (!dates.length) throw new AppError(400, 'Aucune date ne correspond à ces critères.');
  const created = db.transaction(() => {
    const seriesId = b.recurring
      ? Number(db.prepare('INSERT INTO series (description) VALUES (?)').run(`${b.weekdays.join(',')} ${s.start}-${s.end}`).lastInsertRowid) : null;
    const ins = db.prepare('INSERT INTO slots (starts_at, ends_at, capacity, level_id, location, notes, series_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    return dates.map((d) => Number(ins.run(localToUtc(d, s.start), localToUtc(d, s.end), s.capacity, s.levelId, s.location, s.notes, seriesId).lastInsertRowid));
  })();
  res.status(201).json({ created: created.length });
}));

admin.get('/slots/:id', wrap((req, res) => {
  const slot = slotRows('s.id = ?', [Number(req.params.id)])[0];
  if (!slot) throw new AppError(404, 'Séance introuvable.');
  const participants = db.prepare(`
    SELECT b.id AS booking_id, b.created_at AS booked_at, b.presence_confirmed_at, u.* FROM bookings b JOIN users u ON u.id = b.user_id
    WHERE b.slot_id = ? AND b.status = 'booked' ORDER BY b.created_at, b.id`).all(slot.id)
    .map((r) => ({ ...publicUser(r), bookingId: r.booking_id, bookedAt: r.booked_at, presenceConfirmed: Boolean(r.presence_confirmed_at),
      sessionLicense: licenseStatus(r.license_expires, slot.date) }));
  const cancellations = db.prepare(`SELECT b.status, b.cancelled_at, u.first_name, u.last_name FROM bookings b JOIN users u ON u.id = b.user_id
    WHERE b.slot_id = ? AND b.status IN ('cancelled','late_cancelled') ORDER BY b.cancelled_at DESC`).all(slot.id);
  const seriesCount = slot.seriesId ? db.prepare('SELECT COUNT(*) n FROM slots WHERE series_id = ? AND starts_at >= ?').get(slot.seriesId, slot.startsAt).n : 0;
  const guests = db.prepare('SELECT * FROM slot_guests WHERE slot_id = ? ORDER BY id').all(slot.id);
  res.json({ slot, participants, guests, cancellations, seriesCount });
}));

const activeBookers = (slotId) => db.prepare(`SELECT u.* FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.slot_id = ? AND b.status = 'booked'`).all(slotId);

admin.put('/slots/:id', wrap((req, res) => {
  const before = db.prepare('SELECT * FROM slots WHERE id = ?').get(Number(req.params.id));
  if (!before) throw new AppError(404, 'Séance introuvable.');
  const s = readSlotInput(req.body || {});
  const d = date(req.body.date, 'Date');
  const after = { ...before, starts_at: localToUtc(d, s.start), ends_at: localToUtc(d, s.end), capacity: s.capacity, level_id: s.levelId, location: s.location, notes: s.notes };
  const booked = activeBookers(before.id);
  const taken = booked.length + db.prepare('SELECT COALESCE(SUM(places), 0) n FROM slot_guests WHERE slot_id = ?').get(before.id).n;
  if (s.capacity < taken) throw new AppError(400, `Impossible : ${taken} places sont déjà prises. Le nombre de places ne peut pas être inférieur.`);

  const changes = [];
  if (before.starts_at !== after.starts_at || before.ends_at !== after.ends_at) {
    changes.push(utcToLocal(before.starts_at).date !== d ? `nouvelle date : ${fmtDate(after.starts_at)} ${fmtTime(after.starts_at)}` : `nouvel horaire : ${fmtTime(after.starts_at)} – ${fmtTime(after.ends_at)}`);
  }
  if (before.level_id !== after.level_id) changes.push(`niveau requis : ${after.level_id ? db.prepare('SELECT name FROM levels WHERE id = ?').get(after.level_id).name : 'tous niveaux'}`);
  if ((before.location || '') !== (after.location || '')) changes.push(`lieu : ${after.location || getSettings().default_location}`);
  if ((before.notes || '') !== (after.notes || '') && after.notes) changes.push(`remarque : ${after.notes}`);

  db.transaction(() => {
    db.prepare('UPDATE slots SET starts_at = ?, ends_at = ?, capacity = ?, level_id = ?, location = ?, notes = ? WHERE id = ?')
      .run(after.starts_at, after.ends_at, after.capacity, after.level_id, after.location, after.notes, before.id);
    if (before.starts_at !== after.starts_at) db.prepare("UPDATE bookings SET reminder_sent_at = NULL WHERE slot_id = ? AND status = 'booked'").run(before.id);
  })();
  if (changes.length) for (const u of booked) notifyLib.slotChanged(u, before, after, changes);
  res.json({ ok: true, notified: changes.length ? booked.length : 0 });
}));

admin.delete('/slots/:id', wrap((req, res) => {
  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(Number(req.params.id));
  if (!slot) throw new AppError(404, 'Séance introuvable.');
  const targets = req.query.scope === 'series' && slot.series_id
    ? db.prepare('SELECT * FROM slots WHERE series_id = ? AND starts_at >= ?').all(slot.series_id, slot.starts_at)
    : [slot];
  let notified = 0;
  for (const t of targets) {
    const future = new Date(t.starts_at) > new Date();
    const users = future ? activeBookers(t.id) : [];
    db.prepare('DELETE FROM slots WHERE id = ?').run(t.id);
    for (const u of users) { notifyLib.slotDeleted(u, t); notified++; }
  }
  res.json({ deleted: targets.length, notified });
}));

// Inscriptions faites par le gérant (téléphone, invités, groupes)
admin.post('/slots/:id/participants', wrap((req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'member'").get(Number(req.body?.userId));
  if (!user) throw new AppError(404, 'Membre introuvable.');
  const booking = book(user, Number(req.params.id), { byAdmin: true });
  res.status(201).json({ bookingId: booking.id });
}));

admin.post('/slots/:id/guests', wrap((req, res) => {
  const id = addGuest(Number(req.params.id), {
    name: str(req.body?.name, 'Nom', { max: 80 }), places: int(req.body?.places ?? 1, 'Nombre de places', 1, 500),
    phone: str(req.body?.phone, 'Téléphone', { required: false, max: 30 }), note: str(req.body?.note, 'Remarque', { required: false, max: 200 }),
  });
  res.status(201).json({ id });
}));

admin.delete('/guests/:id', wrap((req, res) => {
  const info = db.prepare('DELETE FROM slot_guests WHERE id = ?').run(Number(req.params.id));
  if (!info.changes) throw new AppError(404, 'Invité introuvable.');
  res.json({ ok: true });
}));

admin.delete('/bookings/:id', wrap((req, res) => {
  removeByAdmin(Number(req.params.id));
  res.json({ ok: true });
}));

// Planning habituel : modèle hebdomadaire appliqué sur une période
function readTemplate(raw) {
  let rows;
  try { rows = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { rows = null; }
  if (!Array.isArray(rows) || rows.length > 30) throw new AppError(400, 'Planning habituel invalide.');
  return rows.map((r) => {
    const start = time(r.start, 'Début'); const end = time(r.end, 'Fin');
    if (end <= start) throw new AppError(400, 'Dans le planning habituel, chaque fin doit être après le début.');
    return { weekday: int(r.weekday, 'Jour', 0, 6), start, end, capacity: int(r.capacity, 'Places', 1, 500), levelId: levelId(r.levelId) };
  });
}

admin.post('/slots/template', wrap((req, res) => {
  const tpl = readTemplate(getSettings().weekly_template);
  if (!tpl.length) throw new AppError(400, 'Le planning habituel est vide. Configurez-le dans Réglages.');
  const from = date(req.body?.from, 'Date de début'); const until = date(req.body?.until, 'Date de fin');
  if (until < from) throw new AppError(400, 'La date de fin doit être après la date de début.');
  const location = str(req.body?.location, 'Lieu', { required: false, max: 160 });
  const exists = db.prepare('SELECT 1 FROM slots WHERE starts_at = ?');
  const ins = db.prepare('INSERT INTO slots (starts_at, ends_at, capacity, level_id, location, series_id) VALUES (?, ?, ?, ?, ?, ?)');
  const result = db.transaction(() => {
    const seriesId = Number(db.prepare('INSERT INTO series (description) VALUES (?)').run('Planning habituel').lastInsertRowid);
    let created = 0; let skipped = 0;
    for (let d = from; d <= until; d = addDays(d, 1)) {
      for (const t of tpl.filter((x) => x.weekday === weekdayIndex(d))) {
        const startsAt = localToUtc(d, t.start);
        if (exists.get(startsAt)) { skipped++; continue; } // pas de doublon si déjà créée
        ins.run(startsAt, localToUtc(d, t.end), t.capacity, t.levelId, location, seriesId);
        if (++created > 400) throw new AppError(400, 'Trop de séances d\'un coup (400 max). Réduisez la période.');
      }
    }
    return { created, skipped };
  })();
  res.status(201).json(result);
}));

function memberQuery(q) {
  const today = todayLocal();
  const where = ["u.role = 'member'"]; const params = [];
  if (q.level) { where.push('u.level_id = ?'); params.push(Number(q.level)); }
  if (q.license === 'valid') { where.push('u.license_expires >= ?'); params.push(today); }
  if (q.license === 'soon') { where.push('u.license_expires >= ? AND u.license_expires <= ?'); params.push(today, addDays(today, 30)); }
  if (q.license === 'expired') { where.push('(u.license_expires IS NULL OR u.license_expires < ?)'); params.push(today); }
  if (q.q) {
    where.push("(u.first_name || ' ' || u.last_name || ' ' || u.email || ' ' || COALESCE(u.license_number,'') LIKE ?)");
    params.push(`%${String(q.q).slice(0, 60)}%`);
  }
  return db.prepare(`SELECT u.*,
      (SELECT COUNT(*) FROM late_cancellations lc WHERE lc.user_id = u.id) AS late_count,
      (SELECT COUNT(*) FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE b.user_id = u.id AND b.status = 'booked' AND s.starts_at > ?) AS upcoming
    FROM users u WHERE ${where.join(' AND ')} ORDER BY u.last_name COLLATE NOCASE, u.first_name COLLATE NOCASE`)
    .all(new Date().toISOString(), ...params);
}

admin.get('/members', wrap((req, res) => {
  res.json({ members: memberQuery(req.query).map((r) => ({ ...publicUser(r), lateCount: r.late_count, upcoming: r.upcoming })) });
}));

admin.get('/members.csv', wrap((req, res) => {
  const statusFr = { valid: 'Valide', soon: 'Expire sous 30 j', urgent: 'Expire sous 7 j', expired: 'Expirée', missing: 'Absente' };
  const cols = ['Nom', 'Prénom', 'Date de naissance', 'Téléphone', 'Email', 'Contact urgence', 'Tél. urgence', 'N° licence',
    'Obtention licence', 'Expiration licence', 'Statut licence', 'Niveau', 'Annulations tardives', 'Inscrit le'];
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // protection injection de formules
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = memberQuery(req.query).map((r) => {
    const u = publicUser(r);
    return [u.lastName, u.firstName, u.birthDate, u.phone, u.email, u.emergencyName, u.emergencyPhone, u.licenseNumber,
      u.licenseObtained, u.licenseExpires, statusFr[u.license.status], u.level?.name || '', r.late_count, u.createdAt.slice(0, 10)];
  });
  const csv = '﻿' + [cols, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="membres-multimono-${todayLocal()}.csv"`);
  res.send(csv);
}));

admin.get('/members/:id', wrap((req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'member'").get(Number(req.params.id));
  if (!u) throw new AppError(404, 'Membre introuvable.');
  const upcoming = db.prepare(`SELECT s.*, l.name AS level_name, l.color AS level_color,
      ${takenSql('s')} AS booked
    FROM bookings b JOIN slots s ON s.id = b.slot_id LEFT JOIN levels l ON l.id = s.level_id
    WHERE b.user_id = ? AND b.status = 'booked' AND s.starts_at > ? ORDER BY s.starts_at`).all(u.id, new Date().toISOString()).map(serializeSlot);
  const late = db.prepare('SELECT * FROM late_cancellations WHERE user_id = ? ORDER BY cancelled_at DESC').all(u.id);
  res.json({ member: publicUser(u), upcoming, late });
}));

admin.put('/members/:id/level', wrap((req, res) => {
  const info = db.prepare("UPDATE users SET level_id = ? WHERE id = ? AND role = 'member'").run(levelId(req.body?.levelId), Number(req.params.id));
  if (!info.changes) throw new AppError(404, 'Membre introuvable.');
  res.json({ ok: true });
}));

admin.delete('/members/:id', wrap((req, res) => {
  const info = db.prepare("DELETE FROM users WHERE id = ? AND role = 'member'").run(Number(req.params.id));
  if (!info.changes) throw new AppError(404, 'Membre introuvable.');
  res.json({ ok: true });
}));

admin.get('/late-cancellations', (_req, res) => {
  res.json({ items: db.prepare('SELECT * FROM late_cancellations ORDER BY cancelled_at DESC LIMIT 500').all() });
});

admin.post('/levels', wrap((req, res) => {
  const name = str(req.body?.name, 'Nom du niveau', { max: 40 });
  const color = str(req.body?.color, 'Couleur');
  if (!COLOR_RE.test(color)) throw new AppError(400, 'Couleur invalide.');
  const order = (db.prepare('SELECT MAX(sort_order) m FROM levels').get().m || 0) + 1;
  db.prepare('INSERT INTO levels (name, color, sort_order) VALUES (?, ?, ?)').run(name, color, order);
  res.status(201).json({ levels: levelsAll() });
}));

admin.put('/levels/order', wrap((req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  const upd = db.prepare('UPDATE levels SET sort_order = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => upd.run(i + 1, id)))();
  res.json({ levels: levelsAll() });
}));

admin.put('/levels/:id', wrap((req, res) => {
  const name = str(req.body?.name, 'Nom du niveau', { max: 40 });
  const color = str(req.body?.color, 'Couleur');
  if (!COLOR_RE.test(color)) throw new AppError(400, 'Couleur invalide.');
  const info = db.prepare('UPDATE levels SET name = ?, color = ? WHERE id = ?').run(name, color, Number(req.params.id));
  if (!info.changes) throw new AppError(404, 'Niveau introuvable.');
  res.json({ levels: levelsAll() });
}));

admin.delete('/levels/:id', wrap((req, res) => {
  db.prepare('DELETE FROM levels WHERE id = ?').run(Number(req.params.id));
  res.json({ levels: levelsAll() });
}));

admin.get('/levels/:id/usage', wrap((req, res) => {
  const id = Number(req.params.id);
  res.json({
    members: db.prepare('SELECT COUNT(*) n FROM users WHERE level_id = ?').get(id).n,
    slots: db.prepare('SELECT COUNT(*) n FROM slots WHERE level_id = ? AND starts_at > ?').get(id, new Date().toISOString()).n,
  });
}));

const EDITABLE_SETTINGS = ['club_name', 'default_location', 'license_renew_url', 'rules_text', 'enforce_level', 'weekly_template'];
admin.get('/settings', (_req, res) => {
  const s = getSettings();
  res.json(Object.fromEntries(EDITABLE_SETTINGS.map((k) => [k, s[k]])));
});
admin.put('/settings', wrap((req, res) => {
  const b = req.body || {};
  if (b.license_renew_url && !/^https?:\/\//.test(b.license_renew_url)) throw new AppError(400, 'Le lien de renouvellement doit commencer par https://');
  for (const k of EDITABLE_SETTINGS) {
    if (b[k] === undefined) continue;
    let v;
    if (k === 'enforce_level') v = b[k] === true || b[k] === '1' ? '1' : '0';
    else if (k === 'weekly_template') v = JSON.stringify(readTemplate(b[k]));
    else v = str(b[k], k, { max: k === 'rules_text' ? 10000 : 300 });
    setSetting(k, v);
  }
  res.json({ ok: true });
}));

router.use('/admin', admin);

// ───────────── Erreurs ─────────────
router.use((_req, res) => res.status(404).json({ error: 'Ressource introuvable.' }));
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, _next) => {
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête invalide.' });
  console.error(err);
  res.status(500).json({ error: 'Une erreur est survenue. Réessayez dans un instant.' });
});

module.exports = router;
