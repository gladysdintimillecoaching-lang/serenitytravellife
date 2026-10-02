'use strict';
const crypto = require('crypto');
const config = require('./config');
const { db, getSettings, setSetting } = require('./db');

const COOKIE = 'mm_session';

// Secret applicatif : variable d'env, sinon généré une fois et conservé en base
let secret = config.secret;
if (!secret) {
  secret = getSettings().app_secret;
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    setSetting('app_secret', secret);
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [algo, saltHex, hashHex] = String(stored || '').split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 86400000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires);
  return { token, expires };
}

function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

function setSessionCookie(res, token, expires) {
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: config.isProd, expires: new Date(expires), path: '/',
  });
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const sessionUserStmt = db.prepare(`
  SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = ? AND s.expires_at > ?`);

function loadUser(req, _res, next) {
  const token = readCookie(req, COOKIE);
  req.sessionToken = token;
  req.user = token ? sessionUserStmt.get(sha256(token), new Date().toISOString()) || null : null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Veuillez vous connecter.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Veuillez vous connecter.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès réservé au gérant.' });
  next();
}

/** Jetons signés (liens des emails : confirmer / annuler) */
function signToken(payload, ttlMs) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}

/** Limiteur simple en mémoire (anti force brute) */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
    if (++h.count > max) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
    next();
  };
}

/** Crée le compte du gérant au premier démarrage */
function ensureAdmin() {
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (existing) return;
  let password = config.admin.password;
  let generated = false;
  if (!password) { password = crypto.randomBytes(9).toString('base64url'); generated = true; }
  db.prepare(`INSERT INTO users (role, login, email, password_hash, first_name, last_name, rules_accepted_at)
              VALUES ('admin', ?, ?, ?, ?, '', ?)`)
    .run(config.admin.login, config.admin.email || `${config.admin.login}@multimono.local`, hashPassword(password),
      config.admin.firstName, new Date().toISOString());
  console.log('──────────────────────────────────────────────');
  console.log(` Compte gérant créé — identifiant : ${config.admin.login}`);
  if (generated) console.log(` Mot de passe provisoire : ${password}  (à changer dans Réglages)`);
  console.log('──────────────────────────────────────────────');
}

function cleanupSessions() {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(now);
}

module.exports = {
  COOKIE, hashPassword, verifyPassword, sha256, createSession, destroySession, setSessionCookie,
  loadUser, requireAuth, requireAdmin, signToken, verifyToken, rateLimit, ensureAdmin, cleanupSessions,
};
