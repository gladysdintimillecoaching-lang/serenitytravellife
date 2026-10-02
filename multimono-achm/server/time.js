'use strict';
const { timeZone, tzOffset } = require('./config');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** 'YYYY-MM-DD' + 'HH:MM' (heure de Mayotte) -> ISO UTC */
function localToUtc(date, time) {
  const d = new Date(`${date}T${time}:00${tzOffset}`);
  if (Number.isNaN(d.getTime())) throw new Error('Date ou heure invalide');
  return d.toISOString();
}

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** ISO UTC -> { date: 'YYYY-MM-DD', time: 'HH:MM' } à Mayotte */
function utcToLocal(iso) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

function todayLocal(now = new Date()) {
  return utcToLocal(now.toISOString()).date;
}

/** Ajoute n jours à une date 'YYYY-MM-DD' */
function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = lundi ... 6 = dimanche */
function weekdayIndex(date) {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

const longFmt = new Intl.DateTimeFormat('fr-FR', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit' });

function fmtDate(iso) {
  const s = longFmt.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function fmtTime(iso) {
  return timeFmt.format(new Date(iso)).replace(':', 'h');
}
function fmtSlot(slot) {
  return `${fmtDate(slot.starts_at)}, ${fmtTime(slot.starts_at)} – ${fmtTime(slot.ends_at)}`;
}

/** Statut de licence par rapport à une date de référence (YYYY-MM-DD) */
function licenseStatus(expires, refDate = todayLocal()) {
  if (!expires) return { status: 'missing', daysLeft: null };
  const days = Math.round((new Date(`${expires}T12:00:00Z`) - new Date(`${refDate}T12:00:00Z`)) / DAY);
  if (days < 0) return { status: 'expired', daysLeft: days };
  if (days <= 7) return { status: 'urgent', daysLeft: days };
  if (days <= 30) return { status: 'soon', daysLeft: days };
  return { status: 'valid', daysLeft: days };
}

module.exports = { HOUR, DAY, localToUtc, utcToLocal, todayLocal, addDays, weekdayIndex, fmtDate, fmtTime, fmtSlot, licenseStatus };
