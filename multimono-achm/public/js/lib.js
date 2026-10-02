// ══════════════ Outils partagés ══════════════
export const TZ = 'Indian/Mayotte';

// ── Gabarits HTML sûrs (échappement automatique) ──
class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Safe(String(s));
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(val).join('') : v === false || v == null ? '' : esc(v));
export function html(strings, ...values) {
  return new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? val(values[i]) : ''), ''));
}
export function mount(el, tpl) { el.innerHTML = String(tpl); return el; }
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ── État global ──
export const state = { user: null, config: null, unread: 0 };

// ── Appels API ──
export class ApiError extends Error {
  constructor(status, data) { super(data?.error || 'Erreur réseau'); this.status = status; this.data = data || {}; }
}
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method, credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { error: 'Pas de connexion internet. Vérifiez votre réseau et réessayez.' });
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && state.user) { state.user = null; location.hash = '#/connexion'; }
    throw new ApiError(res.status, data);
  }
  return data;
}

// ── Dates (fuseau de Mayotte) ──
const d12 = (date) => new Date(`${date}T12:00:00Z`);
export function addDays(date, n) { const d = d12(date); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const weekday = (date) => (d12(date).getUTCDay() + 6) % 7; // 0 = lundi
export const mondayOf = (date) => addDays(date, -weekday(date));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const fmtDay = (date, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => cap(d12(date).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...opts }));
export const fmtShort = (date) => d12(date).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
export const fmtFull = (date) => (date ? d12(date).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }) : '—');
export const fmtH = (t) => (t || '').replace(':', 'h');
export function fmtWhen(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d) / 60000;
  if (diff < 1) return 'à l\'instant';
  if (diff < 60) return `il y a ${Math.round(diff)} min`;
  if (diff < 24 * 60) return `il y a ${Math.round(diff / 60)} h`;
  return d.toLocaleString('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export const fmtDateTime = (iso) => cap(new Date(iso).toLocaleString('fr-FR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
export const hoursUntil = (iso) => (new Date(iso) - Date.now()) / 3600000;
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// ── Éléments visuels ──
export const levelBadge = (level) => (level
  ? html`<span class="badge level" style="background:${safeColor(level.color)}">${level.name}</span>`
  : html`<span class="badge">Tous niveaux</span>`);
export const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#22b8cf');

export function licenseBadge(lic) {
  const map = {
    valid: ['ok', 'Licence valide'],
    soon: ['warn', `Expire dans ${lic.daysLeft} j`],
    urgent: ['bad', `Expire dans ${lic.daysLeft} j`],
    expired: ['bad', 'Licence expirée'],
    missing: ['bad', 'Pas de licence'],
  };
  const [cls, txt] = map[lic.status] || map.missing;
  return html`<span class="badge ${cls}">${txt}</span>`;
}
export const initials = (u) => `${(u.firstName || '?')[0]}${(u.lastName || '')[0] || ''}`.toUpperCase();

// ── Icônes (SVG en ligne) ──
const P = {
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  ticket: '<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5Z"/><path d="M14 5v14" stroke-dasharray="2 2.5"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z"/><path d="M10 21h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  dash: '<rect x="3" y="3" width="8" height="10" rx="2"/><rect x="13" y="3" width="8" height="6" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect x="3" y="15" width="8" height="6" rx="2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.5c2.6 0 4.5 1.4 5.5 4.5"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
  sail: '<path d="M12 3v14H5Z"/><path d="M14 6v11h5Z"/><path d="M3 19h18l-2 2H5Z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
export const icon = (name, extra = '') => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] || ''}</svg>`);

// ── Toast ──
export function toast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.getElementById('toast-root').append(el);
  setTimeout(() => el.remove(), 3800);
}

// ── Modale (retourne une promesse avec la valeur du bouton choisi) ──
export function modal({ title, body = '', icon: ico = '', tone = '', actions = [{ label: 'OK', value: true }], left = false, onOpen }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = String(html`
      <div class="modal ${tone}" role="dialog" aria-modal="true" aria-labelledby="m-title">
        ${ico ? html`<div class="m-icon" aria-hidden="true">${ico}</div>` : ''}
        <h2 id="m-title">${title}</h2>
        <div class="m-body ${left ? 'left' : ''}">${body}</div>
        <div class="btn-row">
          ${actions.map((a, i) => html`<button type="button" class="btn ${a.cls || ''}" data-i="${i}">${a.label}</button>`)}
        </div>
      </div>`);
    const prev = document.activeElement;
    const close = (v) => { back.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    back.addEventListener('click', (e) => {
      if (e.target === back) return close(null);
      const b = e.target.closest('[data-i]');
      if (b) close(actions[Number(b.dataset.i)].value);
    });
    document.addEventListener('keydown', onKey);
    root.append(back);
    onOpen?.(back);
    (back.querySelector('.btn:not(.secondary):not(.ghost)') || back.querySelector('.btn'))?.focus();
  });
}

/** Désactive un bouton pendant une action asynchrone */
export async function busy(btn, fn) {
  if (!btn || btn.disabled) return;
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="boat-spin" style="width:20px;height:20px;border-width:3px;margin:0"></span>';
  try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
}

/** Lit un formulaire en objet */
export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else out[el.name] = el.value;
  }
  return out;
}

export function showError(form, err) {
  let box = form.querySelector('.error-msg');
  if (!box) { box = document.createElement('div'); box.className = 'error-msg'; box.setAttribute('role', 'alert'); form.prepend(box); }
  box.textContent = err.message;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export const go = (hash) => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; };
