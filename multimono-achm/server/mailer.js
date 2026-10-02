'use strict';
const nodemailer = require('nodemailer');
const config = require('./config');
const { db, getSettings } = require('./db');

const enabled = Boolean(config.smtp.host);
const transport = enabled
  ? nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    pool: true,
  })
  : null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Gabarit HTML des emails (styles en ligne pour la compatibilité des messageries).
 * lines : paragraphes (texte brut, échappé) ; buttons : [{ label, url, color }]
 */
function renderEmail({ title, lines = [], details = [], buttons = [], footnote }) {
  const club = esc(getSettings().club_name);
  const detailRows = details.map(([k, v]) => `
      <tr><td style="padding:6px 0;color:#5b7a8c;font-size:14px;width:110px">${esc(k)}</td>
          <td style="padding:6px 0;color:#0b3954;font-size:15px;font-weight:600">${esc(v)}</td></tr>`).join('');
  const btns = buttons.map((b) => `
      <a href="${esc(b.url)}" style="display:inline-block;margin:6px 8px 6px 0;padding:14px 22px;border-radius:999px;
         background:${b.color || '#0e7490'};color:#fff;text-decoration:none;font-weight:700;font-size:15px">${esc(b.label)}</a>`).join('');
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#eaf6f8;font-family:Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eaf6f8;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden">
      <tr><td style="background:linear-gradient(135deg,#0b3954,#0e7490 60%,#22b8cf);padding:22px 26px;color:#fff">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">⛵ ${club}</div>
        <div style="font-size:21px;font-weight:700;margin-top:6px">${esc(title)}</div>
      </td></tr>
      <tr><td style="padding:22px 26px;color:#1f3b4d;font-size:15px;line-height:1.55">
        ${lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('')}
        ${detailRows ? `<table role="presentation" style="margin:8px 0 14px;border-top:1px solid #e3eef2;border-bottom:1px solid #e3eef2;width:100%">${detailRows}</table>` : ''}
        ${btns ? `<div style="margin-top:10px">${btns}</div>` : ''}
        ${footnote ? `<p style="margin:16px 0 0;padding:12px 14px;border-radius:12px;background:#fff7e6;color:#8a5a00;font-size:14px">${esc(footnote)}</p>` : ''}
      </td></tr>
      <tr><td style="padding:14px 26px;background:#f6efe2;color:#7a6a4f;font-size:12px">
        Message automatique de ${club} — <a href="${esc(config.appUrl)}" style="color:#0e7490">ouvrir l'application</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const queueStmt = db.prepare('INSERT INTO outbox (to_addr, subject, html) VALUES (?, ?, ?)');

/** Met l'email en file d'attente (envoi asynchrone avec réessais) */
function queueEmail(to, subject, html) {
  if (!to || /@multimono\.local$/.test(to)) return;
  queueStmt.run(to, subject, html);
  setImmediate(flushOutbox);
}

let flushing = false;
async function flushOutbox() {
  if (flushing) return;
  flushing = true;
  try {
    const pending = db.prepare(`SELECT * FROM outbox WHERE status = 'pending' AND attempts < 5 ORDER BY id LIMIT 20`).all();
    for (const m of pending) {
      if (!enabled) {
        console.log(`[email non envoyé — SMTP non configuré] À: ${m.to_addr} | ${m.subject}`);
        db.prepare(`UPDATE outbox SET status = 'skipped', sent_at = ? WHERE id = ?`).run(new Date().toISOString(), m.id);
        continue;
      }
      try {
        await transport.sendMail({ from: config.smtp.from, to: m.to_addr, subject: m.subject, html: m.html });
        db.prepare(`UPDATE outbox SET status = 'sent', sent_at = ?, attempts = attempts + 1 WHERE id = ?`).run(new Date().toISOString(), m.id);
      } catch (err) {
        console.error('Échec envoi email', m.to_addr, err.message);
        db.prepare(`UPDATE outbox SET attempts = attempts + 1, last_error = ?, status = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'pending' END WHERE id = ?`)
          .run(err.message, m.id);
      }
    }
  } finally {
    flushing = false;
  }
}

module.exports = { renderEmail, queueEmail, flushOutbox, emailEnabled: enabled, esc };
