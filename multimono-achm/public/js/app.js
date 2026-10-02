import { api, state, html, mount, icon, $ } from './lib.js';
import * as authViews from './views/auth.js';
import * as member from './views/member.js';
import * as admin from './views/admin.js';
import { refreshUnread } from './views/shared.js';

// Table des routes : [motif, vue, accès]  (accès : public | member | admin | any)
const routes = [
  [/^#\/connexion$/, authViews.login, 'guest'],
  [/^#\/inscription$/, authViews.register, 'guest'],
  [/^#\/mot-de-passe-oublie$/, authViews.forgot, 'public'],
  [/^#\/reinitialiser\/(.+)$/, authViews.reset, 'public'],
  [/^#\/action\/(.+)$/, authViews.emailAction, 'public'],
  [/^#\/reglement$/, authViews.rules, 'public'],
  [/^#\/calendrier$/, member.calendar, 'member'],
  [/^#\/reservations$/, member.bookings, 'member'],
  [/^#\/profil$/, member.profile, 'member'],
  [/^#\/notifications$/, member.notifications, 'any'],
  [/^#\/admin$/, admin.dashboard, 'admin'],
  [/^#\/admin\/seances$/, admin.slots, 'admin'],
  [/^#\/admin\/seance\/nouvelle$/, admin.slotForm, 'admin'],
  [/^#\/admin\/seance\/(\d+)\/modifier$/, admin.slotForm, 'admin'],
  [/^#\/admin\/seance\/(\d+)$/, admin.slotDetail, 'admin'],
  [/^#\/admin\/membres$/, admin.members, 'admin'],
  [/^#\/admin\/membre\/(\d+)$/, admin.memberDetail, 'admin'],
  [/^#\/admin\/annulations$/, admin.lateCancellations, 'admin'],
  [/^#\/admin\/niveaux$/, admin.levels, 'admin'],
  [/^#\/admin\/reglages$/, admin.settings, 'admin'],
  [/^#\/admin\/plus$/, admin.more, 'admin'],
];

const home = () => (state.user ? (state.user.role === 'admin' ? '#/admin' : '#/calendrier') : '#/connexion');

const NAV = {
  member: [
    ['#/calendrier', 'calendar', 'Calendrier'],
    ['#/reservations', 'ticket', 'Réservations'],
    ['#/notifications', 'bell', 'Notifications'],
    ['#/profil', 'user', 'Profil'],
  ],
  admin: [
    ['#/admin', 'dash', 'Tableau'],
    ['#/admin/seances', 'calendar', 'Séances'],
    ['#/admin/membres', 'users', 'Membres'],
    ['#/admin/plus', 'more', 'Plus'],
  ],
};

export function renderChrome() {
  const hash = location.hash.split('?')[0];
  const nav = state.user ? NAV[state.user.role] : null;
  const isActive = (h) => (h === '#/admin' ? hash === h : hash.startsWith(h));
  const dot = (h) => (state.unread && (h === '#/notifications' || (h === '#/admin/plus')) ? html`<span class="dot">${state.unread > 9 ? '9+' : state.unread}</span>` : '');
  mount($('#topbar'), html`
    <div class="topbar-inner">
      <a class="brand" href="${home()}"><img src="/icons/icon.svg" alt=""><span>${state.config?.clubName || 'Multimono ACHM'}<small>${state.user?.role === 'admin' ? 'Espace gérant' : 'Club de voile'}</small></span></a>
      <span class="spacer"></span>
      ${nav ? html`<nav class="top-links" aria-label="Navigation">${nav.map(([h, , l]) => html`<a href="${h}" class="${isActive(h) ? 'active' : ''}">${l}</a>`)}</nav>
        <a class="icon-btn" href="#/notifications" aria-label="Notifications">${icon('bell')}${state.unread ? html`<span class="dot">${state.unread > 9 ? '9+' : state.unread}</span>` : ''}</a>` : ''}
    </div>`);
  mount($('#tabbar'), nav ? html`${nav.map(([h, ic, l]) => html`<a href="${h}" class="${isActive(h) ? 'active' : ''}" ${isActive(h) ? html`aria-current="page"` : ''}>${icon(ic)}<span>${l}</span>${dot(h)}</a>`)}` : '');
  document.body.classList.toggle('no-tabbar', !nav);
}

let renderId = 0;
async function router() {
  const hash = (location.hash || '').split('?')[0];
  const id = ++renderId;
  const found = routes.find(([re]) => re.test(hash));
  if (!found) { location.replace(home()); return; }
  const [re, view, access] = found;
  if (access === 'guest' && state.user) { location.replace(home()); return; }
  if (['member', 'admin', 'any'].includes(access) && !state.user) {
    sessionStorage.setItem('afterLogin', location.hash);
    location.replace('#/connexion'); return;
  }
  if (access === 'member' && state.user.role !== 'member') { location.replace(home()); return; }
  if (access === 'admin' && state.user.role !== 'admin') { location.replace(home()); return; }

  renderChrome();
  // Conteneur neuf à chaque navigation : une vue lente ne peut pas écraser la suivante
  const root = document.createElement('div');
  $('#view').replaceChildren(root);
  mount(root, html`<div class="loading"><div class="boat-spin"></div><p>Chargement…</p></div>`);
  try {
    await view(root, ...hash.match(re).slice(1));
  } catch (err) {
    if (id !== renderId) return;
    mount(root, html`<div class="empty"><span class="big">🌊</span><p>${err.message || 'Une erreur est survenue.'}</p>
      <button class="btn" id="retry">Réessayer</button></div>`);
    $('#retry', root)?.addEventListener('click', router);
  }
  if (id === renderId) { window.scrollTo(0, 0); }
}

export async function boot() {
  const [cfg, me] = await Promise.all([api('/public/config'), api('/me')]);
  state.config = cfg;
  state.user = me.user;
  document.title = cfg.clubName;
  if (state.user) refreshUnread();
  router();
}

window.addEventListener('hashchange', router);
window.addEventListener('app:chrome', renderChrome);

// Rafraîchissement : badge de notifications et vue courante au retour sur l'app
setInterval(() => { if (state.user && !document.hidden) refreshUnread(); }, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.user) { refreshUnread(); window.dispatchEvent(new Event('app:refresh')); }
});

boot().catch(() => {
  mount($('#view'), html`<div class="empty"><span class="big">📡</span><p>Impossible de joindre le serveur. Vérifiez votre connexion.</p>
    <button class="btn" id="reload">Réessayer</button></div>`);
  $('#reload')?.addEventListener('click', () => location.reload());
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
