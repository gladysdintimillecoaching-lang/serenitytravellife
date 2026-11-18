'use strict';
// Cartes activité : 5 séances + 1 offerte. Eric valide chaque séance utilisée (avec sa date).
const { db } = require('./db');
const notifyLib = require('./notify');
const { todayLocal, utcToLocal } = require('./time');

const PAID = 5;
const FREE = 1;

db.exec(`
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  paid INTEGER NOT NULL DEFAULT ${PAID},
  free INTEGER NOT NULL DEFAULT ${FREE},
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  fifth_notified_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);
CREATE TABLE IF NOT EXISTS card_uses (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  slot_id INTEGER REFERENCES slots(id) ON DELETE SET NULL,
  used_on TEXT NOT NULL,
  label TEXT,
  validated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_card_uses_card ON card_uses(card_id);
`);

class CardError extends Error { constructor(status, message) { super(message); this.status = status; } }

const activityName = (id) => (id ? db.prepare('SELECT name FROM activities WHERE id = ?').get(id)?.name || null : null);

function serialize(card) {
  const uses = db.prepare('SELECT * FROM card_uses WHERE card_id = ? ORDER BY used_on, id').all(card.id);
  const total = card.paid + card.free;
  return {
    id: card.id, activity: card.activity_id ? { id: card.activity_id, name: activityName(card.activity_id) } : null,
    paid: card.paid, free: card.free, total, note: card.note, createdAt: card.created_at,
    used: uses.length, remaining: Math.max(0, total - uses.length), finished: uses.length >= total,
    uses: uses.map((u, i) => ({ id: u.id, n: i + 1, date: u.used_on, label: u.label, slotId: u.slot_id, offered: i >= card.paid })),
  };
}

const cardsOf = (userId) => db.prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY id DESC').all(userId).map(serialize);

/**
 * Carte en cours la plus ancienne valable pour l'activité (une carte sans activité vaut pour toutes ;
 * sans activité précisée, n'importe quelle carte en cours).
 */
function activeCard(userId, activityId) {
  return db.prepare(`SELECT c.* FROM cards c WHERE c.user_id = ?
      AND (? IS NULL OR c.activity_id IS NULL OR c.activity_id = ?)
      AND (SELECT COUNT(*) FROM card_uses u WHERE u.card_id = c.id) < c.paid + c.free
    ORDER BY c.id LIMIT 1`).get(userId, activityId ?? null, activityId ?? null); // la plus ancienne d'abord
}

/**
 * Séances encore réservables pour une activité : séances restantes des cartes valables,
 * moins les réservations à venir pas encore validées (elles sont « réservées » sur la carte).
 */
function bookableFor(userId, activityId) {
  const valid = cardsOf(userId).filter((c) => !c.finished && (!c.activity || c.activity.id === activityId));
  const remaining = valid.reduce((a, c) => a + c.remaining, 0);
  const anyAll = valid.some((c) => !c.activity);
  const pending = db.prepare(`SELECT COUNT(*) n FROM bookings b JOIN slots s ON s.id = b.slot_id
      WHERE b.user_id = ? AND b.status = 'booked' AND s.ends_at > ?
        AND (? = 1 OR s.activity_id IS ?)
        AND NOT EXISTS (SELECT 1 FROM card_uses u JOIN cards c ON c.id = u.card_id WHERE c.user_id = b.user_id AND u.slot_id = s.id)`)
    .get(userId, new Date().toISOString(), anyAll ? 1 : 0, activityId ?? null).n;
  return { remaining, pending, available: remaining - pending };
}

/** Résumé pour les listes : séances restantes sur les cartes en cours */
function summary(userId) {
  const cards = cardsOf(userId).filter((c) => !c.finished);
  return { active: cards.length, remaining: cards.reduce((a, c) => a + c.remaining, 0) };
}

function createCard(userId, { activityId = null, note = null } = {}) {
  const id = Number(db.prepare('INSERT INTO cards (user_id, activity_id, note) VALUES (?, ?, ?)').run(userId, activityId, note).lastInsertRowid);
  return serialize(db.prepare('SELECT * FROM cards WHERE id = ?').get(id));
}

/**
 * Valide une séance utilisée.
 * - slotId : séance du calendrier (date et activité reprises de la séance, jamais deux fois la même)
 * - sinon date (YYYY-MM-DD, aujourd'hui par défaut) et activityId optionnels
 */
const validate = db.transaction((user, { slotId = null, date = null, activityId = null }) => {
  let usedOn = date || todayLocal();
  let label = null;
  let actId = activityId;
  if (slotId) {
    const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
    if (!slot) throw new CardError(404, 'Séance introuvable.');
    if (db.prepare('SELECT 1 FROM card_uses u JOIN cards c ON c.id = u.card_id WHERE c.user_id = ? AND u.slot_id = ?').get(user.id, slotId)) {
      throw new CardError(409, `La séance de ${user.first_name} est déjà validée.`);
    }
    const local = utcToLocal(slot.starts_at);
    usedOn = local.date;
    actId = slot.activity_id;
    label = [activityName(slot.activity_id), slot.label, local.time.replace(':', 'h')].filter(Boolean).join(' · ');
  } else if (actId) {
    label = activityName(actId);
  }
  const card = activeCard(user.id, actId);
  if (!card) throw new CardError(409, `${user.first_name} n'a pas de carte en cours${actId ? ' valable pour cette activité' : ''}. Créez d'abord une nouvelle carte.`);
  if (!label && card.activity_id) label = activityName(card.activity_id);
  db.prepare('INSERT INTO card_uses (card_id, slot_id, used_on, label, validated_at) VALUES (?, ?, ?, ?, ?)')
    .run(card.id, slotId, usedOn, label, new Date().toISOString());
  const used = db.prepare('SELECT COUNT(*) n FROM card_uses WHERE card_id = ?').get(card.id).n;
  let event = null;
  if (used === card.paid && !card.fifth_notified_at) {
    db.prepare('UPDATE cards SET fifth_notified_at = ? WHERE id = ?').run(new Date().toISOString(), card.id);
    event = 'last_paid';
  } else if (used === card.paid + card.free) event = 'finished';
  return { card: serialize(db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id)), event };
});

function validateAndNotify(user, opts) {
  const result = validate.immediate(user, opts);
  if (result.event === 'last_paid') notifyLib.cardLastPaid(user, result.card);
  if (result.event === 'finished') notifyLib.cardFinished(user, result.card);
  return result;
}

function undoUse(useId) {
  if (!db.prepare('DELETE FROM card_uses WHERE id = ?').run(useId).changes) throw new CardError(404, 'Validation introuvable.');
}

/** Eric peut changer l'activité d'une carte à tout moment (null = toutes activités) */
function setCardActivity(cardId, activityId) {
  if (!db.prepare('UPDATE cards SET activity_id = ? WHERE id = ?').run(activityId, cardId).changes) throw new CardError(404, 'Carte introuvable.');
  return serialize(db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId));
}

function deleteCard(cardId) {
  if (!db.prepare('DELETE FROM cards WHERE id = ?').run(cardId).changes) throw new CardError(404, 'Carte introuvable.');
}

/** Pour la fiche séance : statut de carte et validation de chaque membre */
function slotStatus(userId, slotId, activityId) {
  const card = activeCard(userId, activityId);
  const validated = Boolean(db.prepare('SELECT 1 FROM card_uses u JOIN cards c ON c.id = u.card_id WHERE c.user_id = ? AND u.slot_id = ?').get(userId, slotId));
  return { validated, card: card ? serialize(card) : null };
}

module.exports = { PAID, FREE, CardError, cardsOf, summary, bookableFor, createCard, validateAndNotify, undoUse, setCardActivity, deleteCard, slotStatus };
