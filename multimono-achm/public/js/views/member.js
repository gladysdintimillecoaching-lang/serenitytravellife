import { api, state, html, mount, $, $$, icon, modal, toast, busy, formData, showError, levelBadge, licenseBadge,
  today, addDays, mondayOf, fmtDay, fmtShort, fmtFull, fmtH, fmtWhen, hoursUntil, go } from '../lib.js';
import { slotCard, bookFlow, cancelFlow, licenseBanner, emptyState, placesBar, refreshUnread } from './shared.js';
import { showRules } from './auth.js';

/** Rafraîchit une vue tant qu'elle est affichée */
export function autoRefresh(root, fn, ms = 30000) {
  const t = setInterval(() => { if (!root.isConnected) return stop(); if (!document.hidden && !document.querySelector('.modal-backdrop')) fn(); }, ms);
  const onFocus = () => (root.isConnected ? fn() : stop());
  function stop() { clearInterval(t); window.removeEventListener('app:refresh', onFocus); }
  window.addEventListener('app:refresh', onFocus);
}

// ══════════ Calendrier ══════════
const cal = { mode: localStorage.getItem('calMode') || 'week', day: null };

export function weekNav(monday) {
  const sunday = addDays(monday, 6);
  const isThisWeek = monday === mondayOf(today());
  return html`<div class="cal-nav">
    <button class="round-btn" data-week="-1" aria-label="Semaine précédente">${icon('left')}</button>
    <div class="title">${fmtShort(monday)} – ${fmtShort(sunday)}${isThisWeek ? html`<div class="small muted" style="font-weight:600">Cette semaine</div>` : html`<div><button class="btn ghost sm" data-today>Revenir à aujourd'hui</button></div>`}</div>
    <button class="round-btn" data-week="1" aria-label="Semaine suivante">${icon('right')}</button>
  </div>`;
}

export function dayStrip(monday, selected, slots) {
  const t = today();
  return html`<div class="daystrip" role="group" aria-label="Jours de la semaine">
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = addDays(monday, i);
    const has = slots.some((s) => s.date === d);
    return html`<button data-day="${d}" aria-pressed="${d === selected}" class="${has ? 'has' : ''} ${d === t ? 'today' : ''}" aria-label="${fmtDay(d)}">
        <small>${fmtDay(d, { weekday: 'short' }).replace('.', '')}</small><b>${Number(d.slice(8))}</b><i></i></button>`;
  })}</div>`;
}

export function dayGroups(monday, slots, card, { hideEmpty = false } = {}) {
  const t = today();
  return html`<div class="week-grid">${[0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = addDays(monday, i);
    const list = slots.filter((s) => s.date === d);
    if (hideEmpty && !list.length) return '';
    return html`<section class="day-group ${list.length ? '' : 'no-slot'} ${d === t ? 'is-today' : ''}" aria-label="${fmtDay(d)}">
      <div class="day-label">${fmtDay(d, { weekday: 'long', day: 'numeric', month: 'short' })}${d === t ? html`<span class="today-pill">Aujourd'hui</span>` : ''}</div>
      ${list.length ? list.map(card) : html`<div class="day-empty">Pas de séance</div>`}
    </section>`;
  })}</div>`;
}

export async function calendar(root) {
  if (!cal.day) cal.day = today();
  let slots = [];

  async function load() {
    const monday = mondayOf(cal.day);
    ({ slots } = await api(`/slots?from=${monday}&to=${addDays(monday, 6)}`));
    render();
  }

  function render() {
    const monday = mondayOf(cal.day);
    const daySlots = slots.filter((s) => s.date === cal.day);
    mount(root, html`
      <div class="page-head"><h1>Calendrier des séances</h1></div>
      ${licenseBanner(state.user, { compact: true })}
      <div class="cal-toolbar">
        <div class="row between">
          <div class="segmented" role="group" aria-label="Affichage">
            <button data-mode="week" aria-pressed="${cal.mode === 'week'}">Semaine</button>
            <button data-mode="day" aria-pressed="${cal.mode === 'day'}">Jour</button>
          </div>
          <span class="small muted">Heure de Mayotte</span>
        </div>
        ${weekNav(monday)}
        ${cal.mode === 'day' ? dayStrip(monday, cal.day, slots) : ''}
      </div>
      ${cal.mode === 'day'
    ? html`<h2 style="margin:4px 4px 10px">${fmtDay(cal.day)}</h2>${daySlots.length ? daySlots.map((s) => slotCard(s)) : emptyState('🏝️', 'Aucune séance ce jour-là.')}`
    : slots.length ? dayGroups(monday, slots, (s) => slotCard(s)) : emptyState('🏝️', 'Aucune séance programmée cette semaine.', html`<button class="btn secondary" data-week="1">Voir la semaine suivante</button>`)}
    `);
  }

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.mode) { cal.mode = t.dataset.mode; localStorage.setItem('calMode', cal.mode); render(); }
    else if (t.dataset.week) { cal.day = addDays(mondayOf(cal.day), 7 * Number(t.dataset.week)); if (cal.day < today() && mondayOf(today()) === mondayOf(cal.day)) cal.day = today(); await load(); }
    else if (t.dataset.today !== undefined) { cal.day = today(); await load(); }
    else if (t.dataset.day) { cal.day = t.dataset.day; render(); }
    else if (t.dataset.book) { await busy(t, () => bookFlow(Number(t.dataset.book))); await load(); }
    else if (t.dataset.cancel) {
      const ok = await cancelFlow(t.dataset.start, (force) => api(`/bookings/${t.dataset.cancel}/cancel`, { method: 'POST', body: { force } }));
      if (ok) await load();
    }
  });
  autoRefresh(root, load);
  await load();
}

// ══════════ Mes réservations ══════════
export async function bookings(root) {
  async function load() {
    const { upcoming } = await api('/me/bookings');
    mount(root, html`
      <div class="page-head"><h1>Mes réservations</h1><a class="btn sm secondary" href="#/calendrier">${icon('plus')} Réserver</a></div>
      ${licenseBanner(state.user, { compact: true })}
      ${upcoming.length ? html`<div class="list">${upcoming.map(({ bookingId, presenceConfirmed, slot }) => {
    const h = hoursUntil(slot.startsAt);
    return html`<article class="slot mine" style="--slot-color:${slot.level?.color || '#22b8cf'}">
          <div class="slot-head">
            <div><div class="small muted" style="font-weight:700">${fmtDay(slot.date)}</div>
              <div class="slot-time">${fmtH(slot.start)} <small>– ${fmtH(slot.end)}</small></div></div>
            ${levelBadge(slot.level)}
          </div>
          <div class="slot-meta">${icon('pin', 'width="16" height="16"')} ${slot.location || state.config.defaultLocation}</div>
          ${placesBar(slot)}
          ${presenceConfirmed ? html`<span class="badge ok">${icon('check', 'width="14" height="14"')} Présence confirmée</span>` : ''}
          ${h < 24 && h > 0 ? html`<div class="banner warn" style="margin:0"><span class="ico">⏰</span><div>Séance dans moins de 24 h : une annulation serait tardive.</div></div>` : ''}
          <div class="btn-row">
            ${!presenceConfirmed && h <= 25 ? html`<button class="btn" data-confirm="${bookingId}">Je confirme ma présence</button>` : ''}
            <button class="btn danger-outline" data-cancel="${bookingId}" data-start="${slot.startsAt}">Annuler</button>
          </div>
        </article>`;
  })}</div>`
    : emptyState('⛵', 'Aucune séance à venir.', html`<a class="btn" href="#/calendrier">Réserver une séance</a>`)}
      <p class="small muted center" style="margin-top:16px">Toute annulation doit être faite au minimum 24 h avant la séance.</p>`);
  }
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.cancel) {
      if (await cancelFlow(t.dataset.start, (force) => api(`/bookings/${t.dataset.cancel}/cancel`, { method: 'POST', body: { force } }))) await load();
    } else if (t.dataset.confirm) {
      await busy(t, async () => {
        try { await api(`/bookings/${t.dataset.confirm}/confirm`, { method: 'POST' }); toast('Présence confirmée, merci ! ⛵', 'ok'); await load(); } catch (err) { toast(err.message, 'bad'); }
      });
    }
  });
  autoRefresh(root, load);
  await load();
}

// ══════════ Notifications ══════════
export async function notifications(root) {
  const { items } = await api('/notifications');
  const myUpcoming = state.user.role === 'member' ? (await api('/me/bookings')).upcoming : [];
  mount(root, html`
    <div class="page-head"><h1>Notifications</h1></div>
    ${items.length ? html`<div class="list">${items.map((n) => {
    const b = n.type === 'reminder' ? myUpcoming.find((x) => x.bookingId === n.data?.bookingId) : null;
    return html`<article class="notif ${n.read_at ? '' : 'unread'} t-${n.type}">
        <div class="when">${fmtWhen(n.created_at)}</div>
        <h3>${n.title}</h3><p>${n.body}</p>
        ${b ? html`<div class="btn-row">
          ${b.presenceConfirmed ? html`<span class="badge ok">Présence confirmée</span>` : html`<button class="btn sm" data-confirm="${b.bookingId}">Je confirme ma présence</button>`}
          <button class="btn sm danger-outline" data-cancel="${b.bookingId}" data-start="${b.slot.startsAt}">Annuler ma réservation</button></div>` : ''}
        ${n.type === 'license' && state.config.licenseRenewUrl ? html`<div class="btn-row"><a class="btn sm sand" href="${state.config.licenseRenewUrl}" target="_blank" rel="noopener">Renouveler ma licence</a><a class="btn sm secondary" href="#/profil">Mettre à jour mon profil</a></div>` : ''}
        ${n.type === 'late_cancel' ? html`<div class="btn-row"><a class="btn sm secondary" href="#/admin/annulations">Voir l'historique</a></div>` : ''}
      </article>`;
  })}</div>` : emptyState('🐚', 'Aucune notification pour le moment.')}`);

  if (items.some((n) => !n.read_at)) {
    await api('/notifications/read', { method: 'POST', body: {} });
    refreshUnread();
  }
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.confirm) {
      await busy(t, async () => {
        try { await api(`/bookings/${t.dataset.confirm}/confirm`, { method: 'POST' }); toast('Présence confirmée, merci ! ⛵', 'ok'); go('#/notifications'); } catch (err) { toast(err.message, 'bad'); }
      });
    } else if (t.dataset.cancel) {
      if (await cancelFlow(t.dataset.start, (force) => api(`/bookings/${t.dataset.cancel}/cancel`, { method: 'POST', body: { force } }))) go('#/notifications');
    }
  });
}

// ══════════ Profil ══════════
export async function profile(root) {
  const { user } = await api('/me');
  state.user = user;
  const levels = state.config.levels;
  mount(root, html`
    <div class="page-head"><h1>Mon profil</h1></div>
    <div id="lic-banner">${licenseBanner(user)}</div>
    <div class="card" style="display:flex;gap:14px;align-items:center">
      <div class="avatar" style="width:64px;height:64px;font-size:1.4rem;--avatar:${user.level?.color || '#0e7490'}">${(user.firstName[0] + (user.lastName[0] || '')).toUpperCase()}</div>
      <div class="grow">
        <h2 style="margin:0">${user.firstName} ${user.lastName}</h2>
        <div class="row" style="margin-top:6px">${levelBadge(user.level)} ${licenseBadge(user.license)}</div>
      </div>
    </div>

    <div class="two-cols">
    <form class="card form" id="f" novalidate>
      <fieldset class="form"><legend>👤 Coordonnées</legend>
        <div class="form-grid two">
          <div class="field"><label for="lastName">Nom</label><input id="lastName" name="lastName" value="${user.lastName}" required></div>
          <div class="field"><label for="firstName">Prénom</label><input id="firstName" name="firstName" value="${user.firstName}" required></div>
        </div>
        <div class="field"><label for="birthDate">Date de naissance</label><input id="birthDate" name="birthDate" type="date" value="${user.birthDate}" required></div>
        <div class="field"><label for="phone">Téléphone</label><input id="phone" name="phone" type="tel" value="${user.phone}" required></div>
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" value="${user.email}" required></div>
      </fieldset>
      <fieldset class="form"><legend>🆘 Contact d'urgence</legend>
        <div class="form-grid two">
          <div class="field"><label for="emergencyName">Nom</label><input id="emergencyName" name="emergencyName" value="${user.emergencyName}" required></div>
          <div class="field"><label for="emergencyPhone">Téléphone</label><input id="emergencyPhone" name="emergencyPhone" type="tel" value="${user.emergencyPhone}" required></div>
        </div>
      </fieldset>
      <fieldset class="form" id="license"><legend>🪪 Licence</legend>
        <div class="field"><label for="licenseNumber">Numéro de licence</label><input id="licenseNumber" name="licenseNumber" value="${user.licenseNumber}" required></div>
        <div class="form-grid two">
          <div class="field"><label for="licenseObtained">Date d'obtention</label><input id="licenseObtained" name="licenseObtained" type="date" value="${user.licenseObtained}" required></div>
          <div class="field"><label for="licenseExpires">Date d'expiration</label><input id="licenseExpires" name="licenseExpires" type="date" value="${user.licenseExpires}" required></div>
        </div>
      </fieldset>
      <fieldset class="form"><legend>⛵ Niveau de navigation</legend>
        <div class="field"><label for="levelId">Niveau</label>
          <select id="levelId" name="levelId">
            <option value="">— Non renseigné —</option>
            ${levels.map((l) => html`<option value="${l.id}" ${l.id === user.level?.id ? 'selected' : ''}>${l.name}</option>`)}
          </select></div>
      </fieldset>
      <button class="btn lg block" type="submit">Enregistrer mes informations</button>
    </form>

    <div>
      <form class="card form" id="pw" novalidate>
        <h2>🔒 Mot de passe</h2>
        <div class="field"><label for="current">Mot de passe actuel</label><input id="current" name="current" type="password" autocomplete="current-password" required></div>
        <div class="field"><label for="next">Nouveau mot de passe</label><input id="next" name="next" type="password" autocomplete="new-password" minlength="8" required></div>
        <button class="btn secondary block" type="submit">Changer le mot de passe</button>
      </form>
      <div class="card">
        <p class="small muted">Règlement accepté le ${fmtFull(user.rulesAcceptedAt?.slice(0, 10))}.</p>
        <div class="btn-row">
          <button class="btn secondary" id="rules">Lire le règlement</button>
          <button class="btn danger-outline" id="logout">${icon('logout')} Se déconnecter</button>
        </div>
      </div>
    </div>
    </div>`);

  const f = $('#f', root);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        const { user: u } = await api('/me', { method: 'PUT', body: formData(f) });
        state.user = u;
        toast('Profil enregistré ✅', 'ok');
        go('#/profil');
      } catch (err) { showError(f, err); }
    });
  });
  const pw = $('#pw', root);
  pw.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(pw.querySelector('[type=submit]'), async () => {
      try { await api('/me/password', { method: 'PUT', body: formData(pw) }); pw.reset(); toast('Mot de passe modifié ✅', 'ok'); } catch (err) { showError(pw, err); }
    });
  });
  // « Renouveler ma licence » : ouvre le site fédéral puis amène au formulaire licence
  $$('[data-renew]', root).forEach((a) => a.addEventListener('click', () => setTimeout(() => {
    $('#license', root)?.scrollIntoView({ behavior: 'smooth' });
    toast('Après renouvellement, mettez à jour la date d\'expiration ci-dessous.');
  }, 400)));
  $('#rules', root).addEventListener('click', showRules);
  $('#logout', root).addEventListener('click', logout);
}

export async function logout() {
  const ok = await modal({ title: 'Se déconnecter ?', icon: '👋', actions: [{ label: 'Rester', value: false, cls: 'secondary' }, { label: 'Se déconnecter', value: true }] });
  if (!ok) return;
  await api('/auth/logout', { method: 'POST' });
  state.user = null; state.unread = 0;
  location.hash = '#/connexion';
}
