'use strict';
// Comptes : identifiants personnels, comptes importés « à activer », codes d'accès donnés par Eric.
const crypto = require('crypto');
const { db } = require('./db');

/** minuscules, sans accents ni espaces superflus */
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** 9 derniers chiffres : 0639…, +262 639…, 262639… comparés à l'identique */
const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-9);

/** Identifiant personnel unique « prenom.nom » (sert à se connecter quand l'email est partagé) */
function makeLogin(firstName, lastName) {
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '');
  const base = [slug(firstName), slug(lastName)].filter(Boolean).join('.') || 'membre';
  let login = base; let n = 2;
  while (db.prepare('SELECT 1 FROM users WHERE login = ?').get(login)) login = `${base}${n++}`;
  return login;
}

/** Code d'accès lisible (sans 0/O/1/I), valable 7 jours, stocké haché */
function newAccessCode(userId) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  db.prepare('UPDATE users SET access_code_hash = ?, access_code_expires = ? WHERE id = ?')
    .run(hashCode(code), new Date(Date.now() + 7 * 86400000).toISOString(), userId);
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
const hashCode = (code) => crypto.createHash('sha256').update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');

function userByCode(code) {
  return db.prepare(`SELECT * FROM users WHERE role = 'member' AND access_code_hash = ? AND access_code_expires > ?`)
    .get(hashCode(code), new Date().toISOString());
}

/** Compte importé jamais activé qui correspond exactement à nom + prénom + téléphone */
function findClaimable({ lastName, firstName, phone }) {
  const key = phoneKey(phone);
  if (key.length < 9 || !norm(lastName) || !norm(firstName)) return null;
  return db.prepare("SELECT * FROM users WHERE role = 'member' AND account_status = 'pending' AND activated_at IS NULL").all()
    .find((u) => norm(u.last_name) === norm(lastName) && norm(u.first_name) === norm(firstName) && phoneKey(u.phone) === key) || null;
}

const CATEGORY_NAMES = {
  'opti loisir': 'Opti Loisir', multimono: 'Multimono', pav: 'Planche à voile (PAV)', 'pav juniors': 'PAV Juniors',
  'multi supports': 'Multi supports', 'ecole de sport': 'École de sport',
};

/**
 * Lignes « catégorie ; nom ; prénom ; téléphone » (copier-coller d'un tableau, CSV ; ou , ou tabulations).
 * Les précisions de la catégorie (« ( NR ) », « voir licence ») deviennent une note pour Eric.
 */
function parseImport(text) {
  const rows = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const sep = raw.includes('\t') ? '\t' : raw.includes(';') ? ';' : ',';
    const cells = raw.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    const [cat = '', last = '', first = '', phone = ''] = cells;
    if (!last && !first) continue;
    if (norm(last) === 'nom' && norm(first).startsWith('prenom')) continue; // ligne d'en-tête
    const m = cat.match(/^(.*?)\s*(\(.*\)|voir .*)?$/i);
    const base = norm(m?.[1] || cat);
    rows.push({
      category: CATEGORY_NAMES[base] || (m?.[1] || cat).trim() || null,
      note: m?.[2] ? m[2].replace(/[()]/g, '').trim() : null,
      lastName: last.toUpperCase(), firstName: first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(),
      phone: phone.replace(/\s+/g, ' ').trim() || null,
    });
  }
  return rows;
}

/** Importe des membres « à activer » (sans email ni mot de passe). Ignore les doublons nom + prénom + téléphone. */
const importMembers = db.transaction((rows) => {
  const existing = db.prepare("SELECT first_name, last_name, phone FROM users WHERE role = 'member'").all()
    .map((u) => `${norm(u.last_name)}|${norm(u.first_name)}|${phoneKey(u.phone)}`);
  const seen = new Set(existing);
  const ins = db.prepare(`INSERT INTO users (role, login, email, password_hash, first_name, last_name, phone, category, admin_note, account_status)
    VALUES ('member', ?, NULL, '', ?, ?, ?, ?, ?, 'pending')`);
  let created = 0; let skipped = 0;
  for (const r of rows) {
    const key = `${norm(r.lastName)}|${norm(r.firstName)}|${phoneKey(r.phone)}`;
    if (!r.firstName || !r.lastName || seen.has(key)) { skipped++; continue; }
    seen.add(key);
    ins.run(makeLogin(r.firstName, r.lastName), r.firstName, r.lastName, r.phone, r.category, r.note);
    created++;
  }
  return { created, skipped };
});

module.exports = { norm, phoneKey, makeLogin, newAccessCode, userByCode, findClaimable, parseImport, importMembers };
