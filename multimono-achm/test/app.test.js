'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'multimono-'));
process.env.DB_FILE = path.join(tmp, 'test.db');
process.env.ADMIN_PASSWORD = 'admin-secret-1';
process.env.ADMIN_EMAIL = 'eric@example.com';

const { createApp } = require('../server/index');
const { ensureAdmin } = require('../server/auth');
const { db } = require('../server/db');
const scheduler = require('../server/scheduler');
const { utcToLocal, todayLocal, addDays } = require('../server/time');

let server; let base;
before(async () => {
  ensureAdmin();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server.close();
  await new Promise((r) => setTimeout(r, 50)); // laisse finir la file d'emails en arrière-plan
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function client() {
  let cookie = '';
  return async (p, { method = 'GET', body } = {}) => {
    const res = await fetch(base + p, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), cookie }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() };
  };
}

const member = (email, extra = {}) => ({
  firstName: 'Léa', lastName: 'Marin', birthDate: '1990-05-01', phone: '0639000000', email,
  emergencyName: 'Paul Marin', emergencyPhone: '0639111111', licenseNumber: 'L123',
  licenseObtained: '2025-01-01', licenseExpires: addDays(todayLocal(), 200), levelId: 1,
  password: 'motdepasse1', acceptRules: true, ...extra,
});
const inHours = (h) => utcToLocal(new Date(Date.now() + h * 3600000).toISOString());

const admin = client();
const alice = client();
const bob = client();

test('inscription : règlement obligatoire puis création du compte', async () => {
  let r = await alice('/auth/register', { method: 'POST', body: member('alice@example.com', { acceptRules: false }) });
  assert.equal(r.status, 400);
  r = await alice('/auth/register', { method: 'POST', body: member('alice@example.com') });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.license.status, 'valid');
  r = await bob('/auth/register', { method: 'POST', body: member('bob@example.com', { firstName: 'Bob' }) });
  assert.equal(r.status, 201);
});

test('connexion gérant par identifiant et accès protégé', async () => {
  assert.equal((await alice('/admin/dashboard')).status, 403);
  const r = await admin('/auth/login', { method: 'POST', body: { login: 'eric', password: 'admin-secret-1' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, 'admin');
});

let slotA;
test('réservation : places restantes et créneau complet', async () => {
  const t = inHours(72);
  let r = await admin('/admin/slots', { method: 'POST', body: { date: t.date, start: '09:00', end: '11:00', capacity: 1, levelId: 2 } });
  assert.equal(r.status, 201);
  r = await alice(`/slots?from=${t.date}&to=${t.date}`);
  slotA = r.body.slots[0];
  assert.equal(slotA.remaining, 1);
  assert.equal(slotA.level.name, 'Initié');
  assert.equal((await alice(`/slots/${slotA.id}/book`, { method: 'POST' })).status, 201);
  assert.equal((await alice(`/slots/${slotA.id}/book`, { method: 'POST' })).status, 409);
  r = await bob(`/slots/${slotA.id}/book`, { method: 'POST' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'full');
  r = await bob(`/slots?from=${t.date}&to=${t.date}`);
  assert.equal(r.body.slots[0].full, true);
  assert.equal(r.body.slots[0].myBookingId, null);
  // Les noms des inscrits ne sont pas exposés aux participants
  assert.ok(!JSON.stringify(r.body).includes('Marin'));
});

test('annulation à plus de 24 h : place libérée, non tardive', async () => {
  const { body } = await alice('/me/bookings');
  const r = await alice(`/bookings/${body.upcoming[0].bookingId}/cancel`, { method: 'POST', body: {} });
  assert.deepEqual([r.body.late, r.body.needsConfirm], [false, false]);
  const t = inHours(72);
  const s = (await bob(`/slots?from=${t.date}&to=${t.date}`)).body.slots[0];
  assert.equal(s.remaining, 1);
});

test('annulation à moins de 24 h : confirmation requise puis signalée au gérant', async () => {
  const start = new Date(Date.now() + 10 * 3600000);
  const slotId = Number(db.prepare('INSERT INTO slots (starts_at, ends_at, capacity) VALUES (?, ?, 4)')
    .run(start.toISOString(), new Date(start.getTime() + 7200000).toISOString()).lastInsertRowid);
  const { body: bk } = await bob(`/slots/${slotId}/book`, { method: 'POST' });
  let r = await bob(`/bookings/${bk.bookingId}/cancel`, { method: 'POST', body: {} });
  assert.equal(r.body.needsConfirm, true);
  r = await bob(`/bookings/${bk.bookingId}/cancel`, { method: 'POST', body: { force: true } });
  assert.equal(r.body.late, true);
  r = await admin('/admin/late-cancellations');
  assert.equal(r.body.items.length, 1);
  const n = await admin('/notifications');
  assert.ok(n.body.items.some((x) => x.type === 'late_cancel'));
});

test('licence expirée : réservation bloquée', async () => {
  const carl = client();
  await carl('/auth/register', { method: 'POST', body: member('carl@example.com', { licenseObtained: '2020-01-01', licenseExpires: addDays(todayLocal(), -1) }) });
  const r = await carl(`/slots/${slotA.id}/book`, { method: 'POST' });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'license');
  const me = await carl('/me');
  assert.equal(me.body.user.license.status, 'expired');
});

test('rappel 24 h avant : envoyé une fois, annulation dans la marge non tardive', async () => {
  const start = new Date(Date.now() + 23.95 * 3600000);
  const end = new Date(start.getTime() + 2 * 3600000);
  const slotId = Number(db.prepare('INSERT INTO slots (starts_at, ends_at, capacity) VALUES (?, ?, 5)').run(start.toISOString(), end.toISOString()).lastInsertRowid);
  const userId = db.prepare("SELECT id FROM users WHERE email = 'alice@example.com'").get().id;
  const bookingId = Number(db.prepare('INSERT INTO bookings (slot_id, user_id, created_at) VALUES (?, ?, ?)').run(slotId, userId, new Date(Date.now() - 3 * 86400000).toISOString()).lastInsertRowid);
  assert.equal(scheduler.sendReminders(), 1);
  assert.equal(scheduler.sendReminders(), 0);
  const n = (await alice('/notifications')).body.items.find((x) => x.type === 'reminder');
  assert.match(n.body, /dernière limite pour annuler/);
  const outbox = db.prepare("SELECT html FROM outbox WHERE subject LIKE 'Rappel%'").get();
  assert.match(outbox.html, /Je confirme ma présence/);
  assert.match(outbox.html, /Annuler ma réservation/);
  const r = await alice(`/bookings/${bookingId}/cancel`, { method: 'POST', body: {} });
  assert.equal(r.body.late, false);
});

test('alerte de licence à 30 jours puis 7 jours, sans doublon', async () => {
  const today = todayLocal();
  db.prepare("UPDATE users SET license_expires = ? WHERE email = 'bob@example.com'").run(addDays(today, 20));
  const before = scheduler.sendLicenseAlerts(today);
  assert.ok(before >= 1);
  assert.equal(scheduler.sendLicenseAlerts(today), 0);
  db.prepare("UPDATE users SET license_expires = ? WHERE email = 'bob@example.com'").run(addDays(today, 20));
  assert.equal(scheduler.sendLicenseAlerts(addDays(today, 14)), 1); // J-6
  const me = await bob('/me');
  assert.equal(me.body.user.license.status, 'soon');
});

test('modification d\'un créneau par le gérant : inscrits notifiés', async () => {
  const t = inHours(96);
  await admin('/admin/slots', { method: 'POST', body: { date: t.date, start: '14:00', end: '16:00', capacity: 3 } });
  const slot = (await bob(`/slots?from=${t.date}&to=${t.date}`)).body.slots.find((s) => s.start === '14:00');
  await bob(`/slots/${slot.id}/book`, { method: 'POST' });
  let r = await admin(`/admin/slots/${slot.id}`, { method: 'PUT', body: { date: t.date, start: '15:00', end: '17:00', capacity: 0 } });
  assert.equal(r.status, 400);
  r = await admin(`/admin/slots/${slot.id}`, { method: 'PUT', body: { date: t.date, start: '15:00', end: '17:00', capacity: 3 } });
  assert.equal(r.body.notified, 1);
  r = await admin(`/admin/slots/${slot.id}`, { method: 'DELETE' });
  assert.equal(r.body.notified, 1);
  const types = (await bob('/notifications')).body.items.map((x) => x.type);
  assert.ok(types.includes('slot_changed') && types.includes('slot_deleted'));
});

test('séances récurrentes', async () => {
  const from = addDays(todayLocal(), 30);
  const r = await admin('/admin/slots', { method: 'POST', body: { recurring: true, weekdays: [2, 5], from, until: addDays(from, 13), start: '08:00', end: '10:00', capacity: 6 } });
  assert.equal(r.body.created, 4);
});

test('liste des membres filtrée et export CSV', async () => {
  let r = await admin('/admin/members?license=expired');
  assert.deepEqual(r.body.members.map((m) => m.email), ['carl@example.com']);
  r = await admin('/admin/members.csv');
  assert.ok(r.body.replace(/^\uFEFF/, '').startsWith('Nom;Prénom'));
  assert.ok(r.body.includes('alice@example.com'));
  assert.equal((await alice('/admin/members.csv')).status, 403);
});

test('niveaux : création avec couleur, validation', async () => {
  let r = await admin('/admin/levels', { method: 'POST', body: { name: 'Régate', color: '#8b5cf6' } });
  assert.ok(r.body.levels.some((l) => l.name === 'Régate' && l.color === '#8b5cf6'));
  r = await admin('/admin/levels', { method: 'POST', body: { name: 'X', color: 'red' } });
  assert.equal(r.status, 400);
});

test('planning de l\'école de voile : 13 séances par semaine, activités et groupes PAV, sans doublon', async () => {
  const from = addDays(todayLocal(), 60);
  const monday = addDays(from, -((new Date(`${from}T12:00:00Z`).getUTCDay() + 6) % 7));
  let r = await admin('/admin/slots/template', { method: 'POST', body: { from: monday, until: addDays(monday, 13) } });
  assert.deepEqual(r.body, { created: 26, skipped: 0 });
  r = await admin('/admin/slots/template', { method: 'POST', body: { from: monday, until: addDays(monday, 13) } });
  assert.deepEqual(r.body, { created: 0, skipped: 26 });
  const { slots } = (await alice(`/slots?from=${monday}&to=${addDays(monday, 6)}`)).body;
  const view = slots.map((x) => `${x.date.slice(8)}|${x.start}-${x.end}|${x.activity.name}${x.label ? `|${x.label}` : ''}`);
  const d = (n) => addDays(monday, n).slice(8);
  assert.deepEqual(view, [
    `${d(2)}|14:00-16:30|École de sport`,
    `${d(3)}|09:00-12:00|Multimono en semaine`,
    `${d(4)}|08:30-11:30|Laser en semaine`,
    `${d(4)}|14:00-16:30|Opti Loisir`,
    `${d(5)}|09:00-11:30|Multimono week-end`,
    `${d(5)}|09:30-12:00|Planche à voile (PAV)`,
    `${d(5)}|12:00-14:30|Multimono week-end`,
    `${d(5)}|14:00-17:00|Laser week-end`,
    `${d(5)}|15:00-17:30|Multimono week-end`,
    `${d(6)}|09:00-11:30|Planche à voile (PAV)|1 · Débutant`,
    `${d(6)}|12:00-14:30|Planche à voile (PAV)|2 · Junior`,
    `${d(6)}|14:00-17:00|Laser week-end`,
    `${d(6)}|15:00-17:30|Planche à voile (PAV)|3 · Confirmé`,
  ]);
  assert.ok(slots.every((x) => x.capacity === 6));
  // Eric gère les activités (nom + couleur)
  const acts = (await admin('/admin/activities', { method: 'POST', body: { name: 'Catamaran', color: '#123456' } })).body.activities;
  assert.ok(acts.some((x) => x.name === 'Catamaran'));
  assert.equal((await alice('/admin/activities', { method: 'POST', body: { name: 'X', color: '#123456' } })).status, 403);
});

test('gérant : invité/groupe sur plusieurs places, inscription et retrait d\'un membre', async () => {
  const t = inHours(120);
  await admin('/admin/slots', { method: 'POST', body: { date: t.date, start: '06:00', end: '07:00', capacity: 6 } });
  const slot = (await alice(`/slots?from=${t.date}&to=${t.date}`)).body.slots.find((x) => x.start === '06:00');
  let r = await admin(`/admin/slots/${slot.id}/guests`, { method: 'POST', body: { name: 'Anffane', places: 5 } });
  assert.equal(r.status, 201);
  r = await admin(`/admin/slots/${slot.id}/guests`, { method: 'POST', body: { name: 'Trop', places: 2 } });
  assert.equal(r.status, 409);
  const bobId = db.prepare("SELECT id FROM users WHERE email = 'bob@example.com'").get().id;
  r = await admin(`/admin/slots/${slot.id}/participants`, { method: 'POST', body: { userId: bobId } });
  assert.equal(r.status, 201);
  const s2 = (await alice(`/slots?from=${t.date}&to=${t.date}`)).body.slots.find((x) => x.id === slot.id);
  assert.equal(s2.full, true);
  assert.equal((await alice(`/slots/${slot.id}/book`, { method: 'POST' })).body.code, 'full');
  const detail = (await admin(`/admin/slots/${slot.id}`)).body;
  assert.equal(detail.guests[0].places, 5);
  r = await admin(`/admin/bookings/${detail.participants[0].bookingId}`, { method: 'DELETE' });
  assert.equal(r.status, 200);
  const notifs = (await bob('/notifications')).body.items;
  assert.ok(notifs.some((x) => x.title.includes('retirée')));
  r = await admin(`/admin/slots/${slot.id}`, { method: 'PUT', body: { date: t.date, start: '06:00', end: '07:00', capacity: 4 } });
  assert.equal(r.status, 400);
  assert.equal((await admin(`/admin/guests/${detail.guests[0].id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await alice(`/slots/${slot.id}/book`, { method: 'POST' })).status, 201);
});

test('revue : pas d\'invités sur une séance passée, planning sans séance passée', async () => {
  const start = new Date(Date.now() - 3600000);
  const pastId = Number(db.prepare('INSERT INTO slots (starts_at, ends_at, capacity) VALUES (?, ?, 6)')
    .run(start.toISOString(), new Date(start.getTime() + 7200000).toISOString()).lastInsertRowid);
  assert.equal((await admin(`/admin/slots/${pastId}/guests`, { method: 'POST', body: { name: 'X', places: 1 } })).status, 400);
  const before = db.prepare('SELECT COUNT(*) n FROM slots WHERE starts_at < ?').get(new Date().toISOString()).n;
  await admin('/admin/slots/template', { method: 'POST', body: { from: addDays(todayLocal(), -14), until: addDays(todayLocal(), 1) } });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM slots WHERE starts_at < ?').get(new Date().toISOString()).n, before);
});

test('inscrits visibles par tous (prénoms) et inscription d\'un ami du club', async () => {
  const t = inHours(150);
  await admin('/admin/slots', { method: 'POST', body: { date: t.date, start: '07:00', end: '08:00', capacity: 3 } });
  const find = async (who) => (await who(`/slots?from=${t.date}&to=${t.date}`)).body.slots.find((x) => x.start === '07:00');
  const slot = await find(alice);
  // Alice inscrit Bob (ami du club)
  const bobId = db.prepare("SELECT id FROM users WHERE email = 'bob@example.com'").get().id;
  const r = await alice('/members/search?q=Bo');
  assert.ok(r.body.members.some((m) => m.id === bobId && m.lastInitial === 'M' && !('email' in m)));
  let b = await alice(`/slots/${slot.id}/book`, { method: 'POST', body: { friendId: bobId } });
  assert.equal(b.status, 201);
  assert.equal(b.body.friend, 'Bob');
  assert.equal((await alice(`/slots/${slot.id}/book`, { method: 'POST', body: { friendId: bobId } })).status, 409);
  // Un ami sans licence valide ne peut pas être inscrit
  const carlId = db.prepare("SELECT id FROM users WHERE email = 'carl@example.com'").get().id;
  b = await alice(`/slots/${slot.id}/book`, { method: 'POST', body: { friendId: carlId } });
  assert.equal(b.body.code, 'friend_license');
  // Tout le monde voit le nombre et les prénoms (pas les noms de famille)
  const seen = await find(bob);
  assert.deepEqual(seen.participants.map((p) => p.firstName), ['Bob']);
  assert.ok(seen.participants[0].me);
  assert.equal(seen.booked, 1);
  assert.ok(!JSON.stringify(seen).includes('Marin'));
  const notif = (await bob('/notifications')).body.items[0];
  assert.match(notif.title, /vous a inscrit/);
  // Alice voit et peut annuler l'inscription de son ami ; Bob est prévenu
  const mine = (await alice('/me/bookings')).body.friends;
  assert.equal(mine[0].friendName, 'Bob');
  assert.equal((await alice(`/bookings/${mine[0].bookingId}/cancel`, { method: 'POST', body: {} })).body.late, false);
  assert.match((await bob('/notifications')).body.items[0].title, /annulée/);
});

test('joyeux anniversaire : le jour J, une seule fois par an, 29 février géré', async () => {
  db.prepare("UPDATE users SET birth_date = '1990-07-14' WHERE email = 'alice@example.com'").run();
  db.prepare("UPDATE users SET birth_date = '1992-02-29' WHERE email = 'bob@example.com'").run();
  assert.equal(scheduler.sendBirthdayWishes('2027-07-13'), 0);
  assert.equal(scheduler.sendBirthdayWishes('2027-07-14'), 1);
  assert.equal(scheduler.sendBirthdayWishes('2027-07-14'), 0);
  const mail = db.prepare("SELECT to_addr, subject FROM outbox WHERE subject LIKE 'Joyeux anniversaire%' ORDER BY id DESC").get();
  assert.equal(mail.to_addr, 'alice@example.com');
  assert.match(mail.subject, /Joyeux anniversaire Léa/);
  assert.equal(scheduler.sendBirthdayWishes('2027-02-28'), 1); // 2027 non bissextile → le 28
  assert.equal(scheduler.sendBirthdayWishes('2028-02-28'), 0); // 2028 bissextile → le 29
  assert.equal(scheduler.sendBirthdayWishes('2028-02-29'), 1);
});

test('récompenses : 8 couleurs, Eric change à la main, email de félicitations si progression', async () => {
  const cfg = (await alice('/public/config')).body;
  assert.deepEqual(cfg.rewards.map((r) => r.name), ['Blanc', 'Jaune', 'Jaune-orange', 'Orange', 'Orange-vert', 'Vert', 'Bleu', 'Violet']);
  const aliceId = db.prepare("SELECT id FROM users WHERE email = 'alice@example.com'").get().id;
  assert.equal((await alice('/me')).body.user.reward.name, 'Blanc');
  assert.equal((await alice(`/admin/members/${aliceId}/reward`, { method: 'PUT', body: { rank: 3 } })).status, 403);
  const count = () => db.prepare("SELECT COUNT(*) n FROM outbox WHERE subject LIKE 'Félicitations%'").get().n;
  const before = count();
  let r = await admin(`/admin/members/${aliceId}/reward`, { method: 'PUT', body: { rank: 5, message: 'Bravo pour samedi !' } });
  assert.equal(r.body.promoted, true);
  assert.equal(count(), before + 1);
  const mail = db.prepare("SELECT subject, html FROM outbox WHERE subject LIKE 'Félicitations%' ORDER BY id DESC").get();
  assert.match(mail.subject, /couleur Vert/);
  assert.match(mail.html, /Prochain objectif : la couleur Bleu/);
  assert.match(mail.html, /Bravo pour samedi/);
  assert.equal((await admin(`/admin/members/${aliceId}/reward`, { method: 'PUT', body: { rank: 5 } })).status, 400);
  r = await admin(`/admin/members/${aliceId}/reward`, { method: 'PUT', body: { rank: 4 } }); // correction
  assert.equal(r.body.promoted, false);
  assert.equal(count(), before + 1);
  await admin(`/admin/members/${aliceId}/reward`, { method: 'PUT', body: { rank: 7 } });
  assert.match(db.prepare("SELECT html FROM outbox WHERE subject LIKE 'Félicitations%' ORDER BY id DESC").get().html, /plus haute récompense/);
  const detail = (await admin(`/admin/members/${aliceId}`)).body;
  assert.equal(detail.member.reward.name, 'Violet');
  assert.equal(detail.rewardHistory.length, 3);
  assert.deepEqual((await admin('/admin/members?reward=7')).body.members.map((m) => m.email), ['alice@example.com']);
  assert.ok((await admin('/admin/members.csv')).body.includes('Récompense'));
});
