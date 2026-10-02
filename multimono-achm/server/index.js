'use strict';
const path = require('path');
const express = require('express');
const config = require('./config');
const auth = require('./auth');
const api = require('./api');
const scheduler = require('./scheduler');
const { emailEnabled } = require('./mailer');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (config.isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  app.get('/healthz', (_req, res) => res.json({ ok: true }));

  // Protection CSRF : les requêtes qui modifient des données doivent être en JSON
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && !req.is('application/json') && req.headers['content-length'] !== '0' && req.headers['content-length']) {
      return res.status(415).json({ error: 'Format non supporté.' });
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(auth.loadUser);
  app.use('/api', api);

  const pub = path.join(__dirname, '..', 'public');
  app.use(express.static(pub, {
    setHeaders(res, file) {
      // Code toujours revalidé (ETag) : après une mise à jour, tout le monde a la même version
      if (/\.(png|svg)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=86400');
      else res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  return app;
}

if (require.main === module) {
  auth.ensureAdmin();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`⛵ Multimono ACHM en ligne sur ${config.appUrl} (port ${config.port})`);
    if (!emailEnabled) console.log('ℹ️  SMTP non configuré : les emails sont affichés dans la console au lieu d\'être envoyés.');
  });
  scheduler.start();
}

module.exports = { createApp };
