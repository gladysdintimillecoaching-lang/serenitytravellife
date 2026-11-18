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
  email TEXT COLLATE NOCASE,
  password_hash TEXT NOT NULL DEFAULT '',
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

-- Un seul message d'anniversaire par membre et par an
CREATE TABLE IF NOT EXISTS birthday_wishes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, year)
);

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

// Migration : réservation faite par un autre membre (« inscrire un ami »)
if (!db.prepare('PRAGMA table_info(bookings)').all().some((c) => c.name === 'booked_by')) {
  db.exec('ALTER TABLE bookings ADD COLUMN booked_by INTEGER REFERENCES users(id) ON DELETE SET NULL');
}

// Migration : email partageable (familles) et facultatif (membres importés sans email).
// SQLite ne sait pas retirer une contrainte : on reconstruit la table (procédure officielle).
const emailCol = db.prepare('PRAGMA table_info(users)').all().find((c) => c.name === 'email');
const emailUnique = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get().sql.includes('NOT NULL UNIQUE');
if (emailCol && emailUnique) {
  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    const createSql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get().sql
      .replace('email TEXT NOT NULL UNIQUE COLLATE NOCASE', 'email TEXT COLLATE NOCASE')
      .replace('password_hash TEXT NOT NULL,', "password_hash TEXT NOT NULL DEFAULT '',")
      .replace(/CREATE TABLE "?users"?/, 'CREATE TABLE users_new');
    db.exec(createSql);
    db.exec(`INSERT INTO users_new (${cols.join(',')}) SELECT ${cols.join(',')} FROM users`);
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_new RENAME TO users');
    if (db.pragma('foreign_key_check').length) throw new Error('Migration users : clés étrangères invalides');
  })();
  db.pragma('foreign_keys = ON');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

// Migration : comptes importés / à activer, catégorie, note du gérant, code d'accès
{
  const ucols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  const add = (name, def) => { if (!ucols.includes(name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${def}`); };
  add('account_status', "TEXT NOT NULL DEFAULT 'active'"); // 'active' | 'pending' (à activer)
  add('activated_at', 'TEXT');
  add('category', 'TEXT');
  add('admin_note', 'TEXT');
  add('access_code_hash', 'TEXT');
  add('access_code_expires', 'TEXT');
}

// Migration : couleur de récompense (0 = Blanc … 7 = Violet)
if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'reward_rank')) {
  db.exec('ALTER TABLE users ADD COLUMN reward_rank INTEGER NOT NULL DEFAULT 0');
  db.exec('ALTER TABLE users ADD COLUMN reward_updated_at TEXT');
}
db.exec(`CREATE TABLE IF NOT EXISTS reward_history (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_rank INTEGER NOT NULL,
  new_rank INTEGER NOT NULL,
  message TEXT,
  awarded_at TEXT NOT NULL
)`);

// ── Activités de l'école de voile (catégories des séances) ──
db.exec(`CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0e7490',
  sort_order INTEGER NOT NULL DEFAULT 0
)`);
if (!db.prepare('PRAGMA table_info(activities)').all().some((c) => c.name === 'capacity')) {
  db.exec('ALTER TABLE activities ADD COLUMN capacity INTEGER NOT NULL DEFAULT 6'); // places par défaut d'une séance
}
if (!db.prepare('PRAGMA table_info(slots)').all().some((c) => c.name === 'activity_id')) {
  db.exec('ALTER TABLE slots ADD COLUMN activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL');
  db.exec('ALTER TABLE slots ADD COLUMN label TEXT'); // ex. « Débutant », « Junior »
}

const ACTIVITIES = [
  ['École de sport', '#0EA5E9'], ['Multimono en semaine', '#0E7490'], ['Laser en semaine', '#E11D48'],
  ['Opti Loisir', '#F59E0B'], ['Multimono week-end', '#14B8A6'], ['Planche à voile (PAV)', '#8B5CF6'], ['Laser week-end', '#DC2626'],
];

/** Planning de l'école de voile (0 = lundi … 6 = dimanche) */
function schoolTemplate() {
  const id = (name) => db.prepare('SELECT id FROM activities WHERE name = ?').get(name)?.id ?? null;
  const cap = (name) => (name.startsWith('Planche à voile') ? 4 : 6); // PAV : 4 personnes par séance
  const row = (activity, weekday, start, end, label = null) => ({ activityId: id(activity), label, weekday, start, end, capacity: cap(activity) });
  return [
    row('École de sport', 2, '14:00', '16:30'),
    row('Multimono en semaine', 3, '09:00', '12:00'),
    row('Laser en semaine', 4, '08:30', '11:30'),
    row('Opti Loisir', 4, '14:00', '16:30'),
    row('Multimono week-end', 5, '09:00', '11:30'),
    row('Multimono week-end', 5, '12:00', '14:30'),
    row('Multimono week-end', 5, '15:00', '17:30'),
    row('Planche à voile (PAV)', 5, '09:30', '12:00'),
    row('Laser week-end', 5, '14:00', '17:00'),
    row('Planche à voile (PAV)', 6, '09:00', '11:30', '1 · Débutant'),
    row('Planche à voile (PAV)', 6, '12:00', '14:30', '2 · Junior'),
    row('Planche à voile (PAV)', 6, '15:00', '17:30', '3 · Confirmé'),
    row('Laser week-end', 6, '14:00', '17:00'),
  ];
}

const DEFAULT_SETTINGS = {
  club_name: 'Multimono ACHM',
  default_location: 'Club de voile ACHM',
  license_renew_url: 'https://www.ffvoile.fr/ffv/web/licence/',
  enforce_level: '0',
  require_card: '1', // réservation possible seulement avec une carte activité ayant des séances disponibles
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
// (une seule fois : si Eric choisit ensuite ce nom, il est conservé)
if (!db.prepare("SELECT 1 FROM settings WHERE key = 'migration_location_v1'").get()) {
  db.prepare("UPDATE settings SET value = 'Club de voile ACHM' WHERE key = 'default_location' AND value = 'Base nautique ACHM'").run();
  db.prepare("INSERT INTO settings (key, value) VALUES ('migration_location_v1', '1')").run();
}

// Activités : créées une fois, puis le planning habituel passe au planning complet de l'école
// (seulement s'il était encore le planning d'origine ; un planning modifié par Eric est conservé)
if (!db.prepare("SELECT 1 FROM settings WHERE key = 'migration_activities_v1'").get()) {
  db.transaction(() => {
    if (db.prepare('SELECT COUNT(*) n FROM activities').get().n === 0) {
      const ins = db.prepare('INSERT INTO activities (name, color, sort_order) VALUES (?, ?, ?)');
      ACTIVITIES.forEach(([n, c], i) => ins.run(n, c, i + 1));
    }
    const current = db.prepare("SELECT value FROM settings WHERE key = 'weekly_template'").get()?.value;
    if (current === DEFAULT_SETTINGS.weekly_template) {
      db.prepare("UPDATE settings SET value = ? WHERE key = 'weekly_template'").run(JSON.stringify(schoolTemplate()));
    }
    db.prepare("INSERT INTO settings (key, value) VALUES ('migration_activities_v1', '1')").run();
  })();
}

// PAV : 4 personnes par séance (activité, planning habituel et séances à venir qui le permettent)
if (!db.prepare("SELECT 1 FROM settings WHERE key = 'migration_pav_capacity_v1'").get()) {
  db.transaction(() => {
    const pav = db.prepare("SELECT id FROM activities WHERE name LIKE 'Planche à voile%'").all().map((a) => a.id);
    for (const id of pav) {
      db.prepare('UPDATE activities SET capacity = 4 WHERE id = ?').run(id);
      db.prepare(`UPDATE slots SET capacity = 4 WHERE activity_id = ? AND capacity > 4 AND starts_at > ?
        AND (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = slots.id AND b.status = 'booked')
          + (SELECT COALESCE(SUM(places), 0) FROM slot_guests g WHERE g.slot_id = slots.id) <= 4`).run(id, new Date().toISOString());
    }
    const raw = db.prepare("SELECT value FROM settings WHERE key = 'weekly_template'").get()?.value;
    try {
      const tpl = JSON.parse(raw || '[]').map((r) => (pav.includes(r.activityId) && r.capacity > 4 ? { ...r, capacity: 4 } : r));
      db.prepare("UPDATE settings SET value = ? WHERE key = 'weekly_template'").run(JSON.stringify(tpl));
    } catch { /* planning illisible : laissé tel quel */ }
    db.prepare("INSERT INTO settings (key, value) VALUES ('migration_pav_capacity_v1', '1')").run();
  })();
}

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
