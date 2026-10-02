'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

db.exec(`
CREATE TABLE IF NOT EXISTS levels (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0ea5b7',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  login TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  birth_date TEXT,
  phone TEXT,
  emergency_name TEXT,
  emergency_phone TEXT,
  license_number TEXT,
  license_obtained TEXT,
  license_expires TEXT,
  level_id INTEGER REFERENCES levels(id) ON DELETE SET NULL,
  rules_accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS slots (
  id INTEGER PRIMARY KEY,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  level_id INTEGER REFERENCES levels(id) ON DELETE SET NULL,
  location TEXT,
  notes TEXT,
  series_id INTEGER REFERENCES series(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_slots_start ON slots(starts_at);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  slot_id INTEGER NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','cancelled','late_cancelled','slot_cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  cancelled_at TEXT,
  reminder_sent_at TEXT,
  presence_confirmed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active ON bookings(slot_id, user_id) WHERE status = 'booked';
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id, status);

-- Historique figé des annulations tardives (survit à la suppression du créneau)
CREATE TABLE IF NOT EXISTS late_cancellations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  slot_id INTEGER,
  slot_starts_at TEXT NOT NULL,
  slot_label TEXT NOT NULL,
  hours_before REAL NOT NULL,
  cancelled_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);

-- Évite d'envoyer deux fois la même alerte de licence
CREATE TABLE IF NOT EXISTS license_alerts (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TEXT NOT NULL,
  kind TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, expires, kind)
);

-- Places réservées par le gérant pour un invité ou un groupe (inscription par téléphone, etc.)
CREATE TABLE IF NOT EXISTS slot_guests (
  id INTEGER PRIMARY KEY,
  slot_id INTEGER NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  places INTEGER NOT NULL DEFAULT 1 CHECK (places > 0),
  phone TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_guests_slot ON slot_guests(slot_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY,
  to_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
`);

const DEFAULT_SETTINGS = {
  club_name: 'Multimono ACHM',
  default_location: 'Club de voile ACHM',
  license_renew_url: 'https://www.ffvoile.fr/ffv/web/licence/',
  enforce_level: '0',
  // Planning habituel de l'ACHM (repris de la feuille « Inscription Multimono ») — 0 = lundi
  weekly_template: JSON.stringify([
    { weekday: 5, start: '12:00', end: '14:30', capacity: 6 },
    { weekday: 5, start: '15:00', end: '17:30', capacity: 6 },
    { weekday: 6, start: '14:00', end: '16:30', capacity: 6 },
  ]),
  rules_text: [
    'Règlement intérieur du club — Multimono ACHM',
    '',
    '1. Le port du gilet de sauvetage est obligatoire sur l\'eau.',
    '2. Une licence en cours de validité est obligatoire pour participer aux séances.',
    '3. Toute annulation doit être faite au minimum 24 h avant la séance.',
    '4. Les consignes de sécurité du moniteur doivent être respectées à tout moment.',
    '5. Le matériel du club est utilisé avec soin et rincé après chaque séance.',
  ].join('\n'),
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);
// Ancien lieu provisoire remplacé par le vrai nom (sans toucher un lieu déjà personnalisé)
db.prepare("UPDATE settings SET value = 'Club de voile ACHM' WHERE key = 'default_location' AND value = 'Base nautique ACHM'").run();

if (db.prepare('SELECT COUNT(*) n FROM levels').get().n === 0) {
  const ins = db.prepare('INSERT INTO levels (name, color, sort_order) VALUES (?, ?, ?)');
  [['Découverte', '#38bdf8', 1], ['Initié', '#14b8a6', 2], ['Confirmé', '#f59e0b', 3], ['Expert', '#ef4444', 4]]
    .forEach((l) => ins.run(...l));
}

function getSettings() {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

/** Nombre de places occupées d'une séance (réservations + invités ajoutés par le gérant) */
const takenSql = (alias) => `((SELECT COUNT(*) FROM bookings bk WHERE bk.slot_id = ${alias}.id AND bk.status = 'booked')
  + (SELECT COALESCE(SUM(g.places), 0) FROM slot_guests g WHERE g.slot_id = ${alias}.id))`;

module.exports = { db, getSettings, setSetting, takenSql, DEFAULT_SETTINGS };
