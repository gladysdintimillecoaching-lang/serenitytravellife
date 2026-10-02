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
// Planning habituel de l'ACHM : samedi 12h00-14h30 et 15h00-17h30, dimanche 14h00-16h30, 6 places
const template = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'weekly_template'").get().value);
let n = 0;
for (let d = -7; d < 21; d++) {
  const date = addDays(today, d);
  for (const t of template.filter((x) => x.weekday === weekdayIndex(date))) {
    const id = slotIns.run(localToUtc(date, t.start), localToUtc(date, t.end), t.capacity, null, null).lastInsertRowid;
    n++;
    users.slice(0, (n * 3) % 6).forEach((u) => db.prepare('INSERT OR IGNORE INTO bookings (slot_id, user_id) VALUES (?, ?)').run(id, u));
    if (n % 4 === 0) db.prepare('INSERT INTO slot_guests (slot_id, name, places, note) VALUES (?, ?, ?, ?)').run(id, 'Groupe découverte', 1, 'Inscrit par téléphone');
  }
}
console.log('Données de démonstration créées (mot de passe des membres : demo1234).');
