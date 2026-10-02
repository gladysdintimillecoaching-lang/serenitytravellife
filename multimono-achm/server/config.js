'use strict';
const path = require('path');
const fs = require('fs');

// Petit chargeur de .env (évite une dépendance supplémentaire)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;

module.exports = {
  port: Number(env.PORT || 3000),
  isProd: env.NODE_ENV === 'production',
  appUrl: (env.APP_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  dbFile: env.DB_FILE || path.join(__dirname, '..', 'data', 'multimono.db'),
  secret: env.APP_SECRET || '',
  timeZone: 'Indian/Mayotte', // UTC+3, pas d'heure d'été
  tzOffset: '+03:00',
  admin: {
    login: (env.ADMIN_LOGIN || 'eric').toLowerCase(),
    password: env.ADMIN_PASSWORD || '',
    email: env.ADMIN_EMAIL || '',
    firstName: env.ADMIN_FIRST_NAME || 'Eric',
  },
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'Multimono ACHM <no-reply@multimono-achm.fr>',
  },
  // Délai d'annulation sans pénalité
  cancelLimitHours: 24,
  // Une annulation faite depuis le rappel (envoyé à H-24) reste « à temps »
  // pendant cette marge, sinon le bouton du rappel serait toujours « tardif ».
  reminderGraceMinutes: Number(env.REMINDER_GRACE_MINUTES || 60),
  sessionDays: 60,
};
