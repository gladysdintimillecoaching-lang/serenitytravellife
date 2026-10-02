'use strict';
// Données de démonstration : node scripts/seed-demo.js  (à n'utiliser que sur une base de test)
const { db } = require('../server/db');
const { hashPassword, ensureAdmin } = require('../server/auth');
const { todayLocal, addDays, localToUtc, weekdayIndex } = require('../server/time');

ensureAdmin();
const today = todayLocal();
const levels = db.prepare('SELECT id FROM levels ORDER BY sort_order').all().map((l) => l.id);
const people = [
  ['Ali', 'Abdallah', 200], ['Fatima', 'Madi', 25], ['Julien', 'Hoarau', 5], ['Nadia', 'Saïd', -3],
  ['Thomas', 'Payet', 300], ['Inès', 'Houmadi', 150], ['Kévin', 'Dupont', 90], ['Sarah', 'Ahamada', 400],
];
const ins = db.prepare(`INSERT OR IGNORE INTO users (role, email, password_hash, first_name, last_name, birth_date, phone,
  emergency_name, emergency_phone, license_number, license_obtained, license_expires, level_id, rules_accepted_at)
  VALUES ('member', ?, ?, ?, ?, '1992-04-12', '0639 12 34 56', 'Contact urgence', '0639 65 43 21', ?, ?, ?, ?, ?)`);
const pwd = hashPassword('demo1234');
people.forEach(([f, l, days], i) => ins.run(`${f.toLowerCase()}@demo.fr`.normalize('NFD').replace(/[̀-ͯ]/g, ''), pwd, f, l,
  `976-${1000 + i}`, addDays(today, days - 365), addDays(today, days), levels[i % levels.length], new Date().toISOString()));

const slotIns = db.prepare('INSERT INTO slots (starts_at, ends_at, capacity, level_id, location) VALUES (?, ?, ?, ?, ?)');
const users = db.prepare("SELECT id FROM users WHERE role = 'member'").all().map((u) => u.id);
for (let d = -2; d < 21; d++) {
  const date = addDays(today, d);
  const wd = weekdayIndex(date);
  const plan = { 2: [['14:00', '16:30', 1]], 5: [['09:00', '11:30', 0], ['14:00', '16:30', 2]], 6: [['08:30', '11:00', 3]] }[wd] || [];
  for (const [s, e, lv] of plan) {
    const id = slotIns.run(localToUtc(date, s), localToUtc(date, e), 6, levels[lv], 'Plage de Sakouli').lastInsertRowid;
    users.slice(0, (Number(id) * 3) % 7).forEach((u) => db.prepare('INSERT OR IGNORE INTO bookings (slot_id, user_id) VALUES (?, ?)').run(id, u));
  }
}
console.log('Données de démonstration créées (mot de passe des membres : demo1234).');
