'use strict';
const config = require('./config');
const { db, getSettings } = require('./db');
const { renderEmail, queueEmail } = require('./mailer');
const { signToken } = require('./auth');
const { fmtDate, fmtTime, DAY } = require('./time');
const { background } = require('./rewards');

const insertNotif = db.prepare('INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?)');
const levelStmt = db.prepare('SELECT name FROM levels WHERE id = ?');
const activityName = (slot) => (slot.activity_id ? db.prepare('SELECT name FROM activities WHERE id = ?').get(slot.activity_id)?.name : null);
const activityLabel = (slot) => [activityName(slot), slot.label].filter(Boolean).join(' · ') || 'Séance';

/** Notification dans l'app + email (optionnel) */
function notify(user, { type, title, body, data, email }) {
  insertNotif.run(user.id, type, title, body, data ? JSON.stringify(data) : null);
  if (email && user.email) queueEmail(user.email, email.subject || title, renderEmail({ title, ...email }));
}

function slotDetails(slot) {
  const level = slot.level_id ? levelStmt.get(slot.level_id)?.name : null;
  return [
    ['Activité', activityLabel(slot)],
    ['Date', fmtDate(slot.starts_at)],
    ['Horaire', `${fmtTime(slot.starts_at)} – ${fmtTime(slot.ends_at)}`],
    ['Niveau', level || 'Tous niveaux'],
    ['Lieu', slot.location || getSettings().default_location],
  ];
}

const short = (slot) => `${fmtDate(slot.starts_at)} à ${fmtTime(slot.starts_at)}`;
const admins = () => db.prepare("SELECT * FROM users WHERE role = 'admin'").all();

function bookingConfirmed(user, slot, booking, bookedBy = null) {
  const by = bookedBy ? `${bookedBy.first_name} ${bookedBy.last_name}` : null;
  notify(user, {
    type: 'booking',
    title: by ? `${bookedBy.first_name} vous a inscrit(e) ⛵` : 'Réservation confirmée ✅',
    body: by ? `${by} vous a réservé une place pour la séance du ${short(slot)}. Vous pouvez annuler depuis « Mes réservations » si vous ne pouvez pas venir.`
      : `Votre place est réservée pour la séance du ${short(slot)}.`,
    data: { slotId: slot.id, bookingId: booking.id },
    email: {
      subject: by ? `${bookedBy.first_name} vous a inscrit(e) — ${short(slot)}` : `Réservation confirmée — ${short(slot)}`,
      lines: by ? [`Bonjour ${user.first_name},`, `${by} vous a inscrit(e) à une séance (${activityLabel(slot)}).`, 'Si vous ne pouvez pas venir, annulez depuis l\'application pour libérer la place.']
        : [`Bonjour ${user.first_name},`, 'Votre place est bien réservée. À bientôt sur l\'eau !'],
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
      subject: `Rappel : ${activityLabel(slot)} demain à ${fmtTime(slot.starts_at)}`,
      lines: [`Bonjour ${user.first_name},`, `Votre séance (${activityLabel(slot)}) commence dans 24 h.`],
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

function removedByAdmin(user, slot) {
  notify(user, {
    type: 'slot_deleted',
    title: 'Réservation retirée par le gérant',
    body: `Le gérant a retiré votre inscription à la séance du ${short(slot)}. Contactez-le si besoin.`,
    data: { slotId: slot.id },
    email: {
      subject: `Votre réservation du ${short(slot)} a été retirée`,
      lines: [`Bonjour ${user.first_name},`, 'Le gérant a retiré votre inscription à la séance suivante (sans pénalité).'],
      details: slotDetails(slot),
      buttons: [{ label: 'Réserver un autre créneau', url: `${config.appUrl}/#/calendrier` }],
    },
  });
}

function cancelledByFriend(member, by, slot) {
  notify(member, {
    type: 'slot_deleted',
    title: 'Votre inscription a été annulée',
    body: `${by.first_name} ${by.last_name}, qui vous avait inscrit(e), a annulé votre place pour la séance du ${short(slot)}.`,
    data: { slotId: slot.id },
    email: {
      subject: `Inscription annulée — ${short(slot)}`,
      lines: [`Bonjour ${member.first_name},`, `${by.first_name} ${by.last_name}, qui vous avait inscrit(e), a annulé votre place.`],
      details: slotDetails(slot),
      buttons: [{ label: 'Réserver un créneau', url: `${config.appUrl}/#/calendrier` }],
    },
  });
}

function birthday(user) {
  notify(user, {
    type: 'birthday',
    title: `Joyeux anniversaire, ${user.first_name} ! 🎂`,
    body: 'Toute l\'équipe du club vous souhaite un très joyeux anniversaire. Que cette nouvelle année vous apporte bon vent et belle mer ! ⛵',
    data: {},
    email: {
      subject: `Joyeux anniversaire ${user.first_name} ! 🎂⛵`,
      lines: [
        `Bonjour ${user.first_name},`,
        'Toute l\'équipe du club vous souhaite un très joyeux anniversaire ! 🎉',
        'Que cette nouvelle année vous apporte bon vent, belle mer et de magnifiques navigations avec le club.',
        'Au plaisir de vous retrouver très vite sur l\'eau.',
        `Eric et l'équipe ${getSettings().club_name}`,
      ],
      buttons: [{ label: 'Réserver ma prochaine séance', url: `${config.appUrl}/#/calendrier` }],
    },
  });
}

function rewardPromotion(user, r, next, message) {
  const lines = [`Bonjour ${user.first_name},`, `Félicitations ! Eric vous a attribué la couleur ${r.name} 🎉`,
    'Cette nouvelle couleur récompense votre progression, votre régularité et votre engagement sur l\'eau. Bravo !'];
  if (next) {
    lines.push(`Prochain objectif : la couleur ${next.name}. Continuez à naviguer régulièrement, à écouter les conseils et à oser de nouveaux défis — chaque séance vous en rapproche !`);
  } else {
    lines.push('Vous avez atteint la plus haute récompense du club. Vous êtes un exemple pour tous les membres : continuez à partager votre passion et à faire progresser les autres !');
  }
  lines.push('Bon vent et à très vite sur l\'eau !', `Eric et l'équipe ${getSettings().club_name}`);
  notify(user, {
    type: 'reward',
    title: `Nouvelle récompense : ${r.name} 🏅`,
    body: `Félicitations ! Vous passez à la couleur ${r.name}.${next ? ` Prochain objectif : ${next.name} !` : ' C\'est la plus haute récompense du club !'}`,
    data: { rank: r.rank },
    email: {
      subject: `Félicitations ${user.first_name} ! Vous passez à la couleur ${r.name} 🏅`,
      lines,
      highlight: { label: `🏅 ${r.name}`, color: r.colors[0], background: background(r), ink: r.ink },
      quote: message ? `Le mot d'Eric : « ${message} »` : null,
      buttons: [{ label: 'Voir ma progression', url: `${config.appUrl}/#/profil` }, { label: 'Réserver une séance', url: `${config.appUrl}/#/calendrier`, color: '#0b3954' }],
    },
  });
}

/** Carte activité : 5e séance utilisée → il reste la séance offerte */
function cardLastPaid(user, card) {
  const what = card.activity ? ` (${card.activity.name})` : '';
  notify(user, {
    type: 'card',
    title: 'Votre 5ème séance est utilisée 🎁',
    body: `Vous venez d'utiliser votre 5ème séance${what}, pas de panique ! Il vous en reste une offerte.`,
    data: { cardId: card.id },
    email: {
      subject: `Votre 5ème séance est utilisée — il vous en reste une offerte 🎁`,
      highlight: { label: '🎁 1 séance offerte', color: '#F6E7C8', ink: '#7A5D2A' },
      lines: [
        `Bonjour ${user.first_name},`,
        `Vous venez d'utiliser votre 5ème séance${what}, pas de panique ! Il vous en reste une offerte 🎁`,
        'Profitez-en bien sur l\'eau ! Pour continuer à naviguer après cette séance offerte, pensez à reprendre une nouvelle carte auprès d\'Eric.',
        `L'équipe ${getSettings().club_name}`,
      ],
      details: card.uses.map((u) => [`Séance ${u.n}`, `${new Date(`${u.date}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}${u.label ? ` · ${u.label}` : ''}`]),
      buttons: [{ label: 'Voir ma carte', url: `${config.appUrl}/#/profil` }, { label: 'Réserver ma séance offerte', url: `${config.appUrl}/#/calendrier`, color: '#0b3954' }],
    },
  });
}

/** Carte activité terminée (séance offerte utilisée) : notification + email */
function cardFinished(user, card) {
  const what = card.activity ? ` (${card.activity.name})` : '';
  notify(user, {
    type: 'card',
    title: 'Votre carte activité est terminée 🎟️',
    body: `Vous avez utilisé vos ${card.total} séances${what}, dont la séance offerte. Pensez à reprendre une nouvelle carte auprès d'Eric pour continuer à naviguer !`,
    data: { cardId: card.id },
    email: {
      subject: 'Votre carte activité est terminée — on continue ensemble ? ⛵',
      highlight: { label: `🎟️ ${card.total}/${card.total} séances utilisées`, color: '#E3F4F7', ink: '#0B3954' },
      lines: [
        `Bonjour ${user.first_name},`,
        `Vous venez d'utiliser votre séance offerte${what} : votre carte de ${card.paid} séances + ${card.free} offerte est terminée. Bravo pour toutes ces navigations ! 👏`,
        'Pour continuer à réserver vos séances, demandez une nouvelle carte à Eric : la réservation en ligne sera de nouveau possible dès qu\'elle sera créée.',
        `À très vite sur l'eau ! L'équipe ${getSettings().club_name}`,
      ],
      details: card.uses.map((u) => [`Séance ${u.n}${u.offered ? ' 🎁' : ''}`, `${new Date(`${u.date}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}${u.label ? ` · ${u.label}` : ''}`]),
      buttons: [{ label: 'Voir ma carte', url: `${config.appUrl}/#/profil` }],
    },
  });
}

function accessCode(user, code) {
  queueEmail(user.email, 'Votre code d\'accès à l\'application du club', renderEmail({
    title: 'Votre nouveau code d\'accès',
    highlight: { label: code, color: '#E3F4F7', ink: '#0B3954' },
    lines: [`Bonjour ${user.first_name},`, 'Eric a réinitialisé votre accès à l\'application. Pour choisir un nouveau mot de passe, ouvrez l\'application, touchez « Première connexion / code d\'accès » et saisissez ce code (valable 7 jours).',
      `Votre identifiant : ${user.login}`],
    buttons: [{ label: 'Choisir mon mot de passe', url: `${config.appUrl}/#/premiere-connexion` }],
  }));
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
    body: `Votre licence expire le ${dateFr} (dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}). Pensez à la renouveler et à la transmettre à Eric pour continuer à réserver.`,
    data: { license: true },
    email: {
      subject: `Votre licence expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
      lines: [`Bonjour ${user.first_name},`, `Votre licence expire le ${dateFr}.`, 'Sans licence valide, la réservation des séances sera bloquée. Après renouvellement, transmettez votre nouvelle licence à Eric : il mettra votre profil à jour.'],
      buttons: [
        { label: 'Renouveler ma licence', url, color: '#0e7490' },
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

module.exports = { notify, bookingConfirmed, reminder, slotChanged, slotDeleted, removedByAdmin, cancelledByFriend, birthday, rewardPromotion, cardLastPaid, cardFinished, accessCode, lateCancellation, licenseAlert, passwordReset };
