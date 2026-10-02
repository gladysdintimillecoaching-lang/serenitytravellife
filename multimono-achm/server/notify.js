'use strict';
const config = require('./config');
const { db, getSettings } = require('./db');
const { renderEmail, queueEmail } = require('./mailer');
const { signToken } = require('./auth');
const { fmtDate, fmtTime, DAY } = require('./time');

const insertNotif = db.prepare('INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?)');
const levelStmt = db.prepare('SELECT name FROM levels WHERE id = ?');

/** Notification dans l'app + email (optionnel) */
function notify(user, { type, title, body, data, email }) {
  insertNotif.run(user.id, type, title, body, data ? JSON.stringify(data) : null);
  if (email && user.email) queueEmail(user.email, email.subject || title, renderEmail({ title, ...email }));
}

function slotDetails(slot) {
  const level = slot.level_id ? levelStmt.get(slot.level_id)?.name : null;
  return [
    ['Date', fmtDate(slot.starts_at)],
    ['Horaire', `${fmtTime(slot.starts_at)} – ${fmtTime(slot.ends_at)}`],
    ['Niveau', level || 'Tous niveaux'],
    ['Lieu', slot.location || getSettings().default_location],
  ];
}

const short = (slot) => `${fmtDate(slot.starts_at)} à ${fmtTime(slot.starts_at)}`;
const admins = () => db.prepare("SELECT * FROM users WHERE role = 'admin'").all();

function bookingConfirmed(user, slot, booking) {
  notify(user, {
    type: 'booking',
    title: 'Réservation confirmée ✅',
    body: `Votre place est réservée pour la séance du ${short(slot)}.`,
    data: { slotId: slot.id, bookingId: booking.id },
    email: {
      subject: `Réservation confirmée — ${short(slot)}`,
      lines: [`Bonjour ${user.first_name},`, 'Votre place est bien réservée. À bientôt sur l\'eau !'],
      details: slotDetails(slot),
      buttons: [{ label: 'Voir mes réservations', url: `${config.appUrl}/#/reservations` }],
      footnote: 'Toute annulation doit être faite au minimum 24 h avant la séance.',
    },
  });
}

function reminder(user, slot, booking) {
  const ttl = new Date(slot.ends_at) - Date.now() + DAY;
  const confirmUrl = `${config.appUrl}/#/action/${signToken({ b: booking.id, a: 'confirm' }, ttl)}`;
  const cancelUrl = `${config.appUrl}/#/action/${signToken({ b: booking.id, a: 'cancel' }, ttl)}`;
  const warning = 'C\'est la dernière limite pour annuler sans risque de perdre votre créneau.';
  notify(user, {
    type: 'reminder',
    title: 'Rappel : votre séance est dans 24 h ⛵',
    body: `Séance du ${short(slot)}. ${warning}`,
    data: { slotId: slot.id, bookingId: booking.id, actions: ['confirm', 'cancel'] },
    email: {
      subject: `Rappel : séance de multimono demain à ${fmtTime(slot.starts_at)}`,
      lines: [`Bonjour ${user.first_name},`, 'Votre séance de multimono commence dans 24 h.'],
      details: slotDetails(slot),
      buttons: [
        { label: 'Je confirme ma présence', url: confirmUrl, color: '#0e7490' },
        { label: 'Annuler ma réservation', url: cancelUrl, color: '#c2410c' },
      ],
      footnote: warning,
    },
  });
}

function slotChanged(user, before, after, changes) {
  notify(user, {
    type: 'slot_changed',
    title: 'Votre séance a été modifiée ✏️',
    body: `La séance du ${short(before)} a été modifiée par le gérant : ${changes.join(', ')}.`,
    data: { slotId: after.id },
    email: {
      subject: `Séance modifiée — ${short(after)}`,
      lines: [`Bonjour ${user.first_name},`, `Le gérant a modifié votre séance initialement prévue le ${short(before)}.`, `Changements : ${changes.join(', ')}.`, 'Nouvelles informations :'],
      details: slotDetails(after),
      buttons: [{ label: 'Voir mes réservations', url: `${config.appUrl}/#/reservations` }],
      footnote: 'Si ce nouvel horaire ne vous convient pas, vous pouvez annuler depuis l\'application.',
    },
  });
}

function slotDeleted(user, slot) {
  notify(user, {
    type: 'slot_deleted',
    title: 'Séance annulée par le club ❌',
    body: `La séance du ${short(slot)} a été supprimée par le gérant. Votre réservation est annulée.`,
    data: {},
    email: {
      subject: `Séance annulée — ${short(slot)}`,
      lines: [`Bonjour ${user.first_name},`, 'Le gérant a dû supprimer la séance suivante. Votre réservation est annulée (sans pénalité).'],
      details: slotDetails(slot),
      buttons: [{ label: 'Réserver un autre créneau', url: `${config.appUrl}/#/calendrier` }],
    },
  });
}

function lateCancellation(member, slot, hoursBefore) {
  for (const a of admins()) {
    notify(a, {
      type: 'late_cancel',
      title: 'Annulation tardive ⚠️',
      body: `${member.first_name} ${member.last_name} a annulé la séance du ${short(slot)} (${hoursBefore.toFixed(1).replace('.', ',')} h avant).`,
      data: { slotId: slot.id, userId: member.id },
      email: {
        subject: `Annulation tardive — ${member.first_name} ${member.last_name}`,
        lines: [`${member.first_name} ${member.last_name} a annulé moins de 24 h avant la séance.`],
        details: [...slotDetails(slot), ['Délai', `${hoursBefore.toFixed(1).replace('.', ',')} h avant`]],
        buttons: [{ label: 'Voir l\'historique', url: `${config.appUrl}/#/admin/annulations` }],
      },
    });
  }
}

function licenseAlert(user, daysLeft, expires) {
  const url = getSettings().license_renew_url;
  const dateFr = new Date(`${expires}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  notify(user, {
    type: 'license',
    title: daysLeft <= 7 ? 'Votre licence expire très bientôt ⏳' : 'Votre licence expire bientôt',
    body: `Votre licence expire le ${dateFr} (dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}). Pensez à la renouveler pour continuer à réserver.`,
    data: { license: true },
    email: {
      subject: `Votre licence expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
      lines: [`Bonjour ${user.first_name},`, `Votre licence expire le ${dateFr}.`, 'Sans licence valide, la réservation des séances sera bloquée. Après renouvellement, mettez à jour vos informations dans votre profil.'],
      buttons: [
        { label: 'Renouveler ma licence', url, color: '#0e7490' },
        { label: 'Mettre à jour mon profil', url: `${config.appUrl}/#/profil`, color: '#0b3954' },
      ],
    },
  });
}

function passwordReset(user, token) {
  queueEmail(user.email, 'Réinitialisation de votre mot de passe', renderEmail({
    title: 'Mot de passe oublié',
    lines: [`Bonjour ${user.first_name},`, 'Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable 1 heure.', 'Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message.'],
    buttons: [{ label: 'Choisir un nouveau mot de passe', url: `${config.appUrl}/#/reinitialiser/${token}` }],
  }));
}

module.exports = { notify, bookingConfirmed, reminder, slotChanged, slotDeleted, lateCancellation, licenseAlert, passwordReset };
