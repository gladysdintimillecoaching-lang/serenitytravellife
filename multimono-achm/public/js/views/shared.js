import { api, state, html, raw, icon, modal, toast, levelBadge, safeColor, activityTitle, slotColor, fmtDay, fmtH, hoursUntil, esc } from '../lib.js';

export async function refreshUnread() {
  try {
    const { unread } = await api('/notifications');
    if (unread !== state.unread) { state.unread = unread; window.dispatchEvent(new Event('app:chrome')); }
  } catch { /* hors ligne : on réessaiera */ }
}

/** Barre de remplissage + texte des places restantes */
export function placesBar(slot) {
  const pct = Math.round((slot.booked / slot.capacity) * 100);
  return html`
    <div class="places">
      <div class="places-text">
        <span>${slot.full ? html`<b style="color:#475569">Complet</b>` : html`<b>${slot.remaining}</b> place${slot.remaining > 1 ? 's' : ''} restante${slot.remaining > 1 ? 's' : ''}`}</span>
        <span class="muted">${slot.booked}/${slot.capacity}</span>
      </div>
      <div class="bar ${pct >= 80 ? 'high' : ''}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
    </div>`;
}

/** Carte d'une séance (vue participant) */
export function slotCard(slot, { showDate = false } = {}) {
  const mine = Boolean(slot.myBookingId);
  let action;
  if (slot.past) action = html`<button class="btn block" disabled>Séance passée</button>`;
  else if (mine) {
    action = html`<div class="btn-row">
      <span class="btn success" style="pointer-events:none">${icon('check')} Inscrit(e)</span>
      <button class="btn danger-outline" data-cancel="${slot.myBookingId}" data-start="${slot.startsAt}">Annuler</button></div>`;
  } else if (slot.full) action = html`<button class="btn block" disabled aria-disabled="true">Complet</button>`;
  else action = html`<button class="btn block" data-book="${slot.id}">Réserver</button>`;
  // Inscrire un ami du club (tant qu'il reste de la place)
  const friendBtn = !slot.past && !slot.full
    ? html`<button class="btn ghost sm" data-friend="${slot.id}" style="justify-self:start">${icon('plus')} Inscrire un ami du club</button>` : '';
  const friends = (slot.friendBookings || []).filter(() => !slot.past);

  return html`
    <article class="slot ${mine ? 'mine' : ''} ${slot.full ? 'is-full' : ''} ${slot.past ? 'past' : ''}" style="--slot-color:${slotColor(slot)}">
      <div class="slot-head">
        <div>
          ${showDate ? html`<div class="small muted" style="font-weight:700">${fmtDay(slot.date)}</div>` : ''}
          ${activityTitle(slot)}
          <div class="slot-time">${fmtH(slot.start)} <small>– ${fmtH(slot.end)}</small></div>
        </div>
        ${levelBadge(slot.level)}
      </div>
      ${slot.location || slot.notes ? html`<div class="slot-meta">
        ${slot.location ? html`<span>${icon('pin', 'width="16" height="16"')} ${slot.location}</span>` : ''}
        ${slot.notes ? html`<span>· ${slot.notes}</span>` : ''}</div>` : ''}
      ${placesBar(slot)}
      ${participantsList(slot)}
      ${friends.length ? html`<div class="list" style="gap:6px">${friends.map((f) => html`
        <div class="row between small" style="background:var(--foam);border-radius:12px;padding:6px 10px">
          <span>Vous avez inscrit <strong>${f.firstName}</strong></span>
          <button class="btn sm danger-outline" data-cancel="${f.bookingId}" data-start="${slot.startsAt}" data-friend-name="${f.firstName}">Annuler</button></div>`)}</div>` : ''}
      ${action}
      ${friendBtn}
    </article>`;
}

/** Inscrits visibles par tous : nombre + prénoms */
export function participantsList(slot) {
  const list = slot.participants || [];
  if (!list.length) return html`<div class="small muted">Aucun inscrit pour l'instant — soyez le premier !</div>`;
  return html`<div class="participants">
    <span class="small" style="font-weight:700;color:var(--abyss)">${slot.booked} inscrit${slot.booked > 1 ? 's' : ''} :</span>
    ${list.map((p) => html`<span class="pchip ${p.me ? 'me' : ''} ${p.guest ? 'guest' : ''}">${p.me ? 'Vous' : p.firstName}${p.guest && p.places > 1 ? ` ×${p.places}` : ''}</span>`)}
  </div>`;
}

/** Choisir un ami du club puis l'inscrire */
export async function friendFlow(slot) {
  let chosen = null;
  const ok = await modal({
    title: 'Inscrire un ami du club', icon: '🤝', left: true,
    body: html`<p class="small muted">${slot.activity ? html`<strong>${slot.activity.name}</strong> · ` : ''}${fmtDay(slot.date)}, ${fmtH(slot.start)} – ${fmtH(slot.end)} · ${slot.remaining} place${slot.remaining > 1 ? 's' : ''} libre${slot.remaining > 1 ? 's' : ''}.
        Votre ami doit être membre du club : il sera prévenu par notification et par email.</p>
      <input type="search" id="fsearch" placeholder="Prénom ou nom (2 lettres minimum)…" aria-label="Rechercher un membre du club" autocomplete="off">
      <div class="list" id="fresults" style="margin-top:10px;max-height:40vh;overflow:auto"></div>`,
    actions: [{ label: 'Annuler', value: false, cls: 'secondary' }, { label: 'Inscrire mon ami', value: true }],
    onOpen(m) {
      const input = m.querySelector('#fsearch'); const out = m.querySelector('#fresults');
      let t;
      input.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(async () => {
          const { members } = await api(`/members/search?q=${encodeURIComponent(input.value.trim())}`);
          chosen = null;
          out.innerHTML = String(input.value.trim().length < 2 ? '' : members.length ? html`${members.map((mb) => html`<label class="check" style="padding:10px">
            <input type="radio" name="friend" value="${mb.id}" data-name="${mb.firstName}">
            <span><strong>${mb.firstName} ${mb.lastInitial}.</strong> ${levelBadge(mb.level)}</span></label>`)}`
            : html`<p class="small muted">Aucun membre trouvé.</p>`);
          out.querySelectorAll('input[name=friend]').forEach((r) => r.addEventListener('change', () => { chosen = { id: Number(r.value), name: r.dataset.name }; }));
        }, 200);
      });
      setTimeout(() => input.focus(), 50);
    },
  });
  if (!ok) return false;
  if (!chosen) { toast('Choisissez un membre dans la liste.', 'bad'); return false; }
  try {
    await api(`/slots/${slot.id}/book`, { method: 'POST', body: { friendId: chosen.id } });
    modal({ title: `${chosen.name} est inscrit(e) !`, icon: '🤝', tone: 'success',
      body: html`<p>${fmtDay(slot.date)}, ${fmtH(slot.start)} – ${fmtH(slot.end)}</p><p class="small muted">${chosen.name} a été prévenu(e) par notification et par email. Vous pouvez annuler cette inscription depuis « Mes réservations ».</p>`,
      actions: [{ label: 'Parfait !', value: true }] });
    return true;
  } catch (err) {
    modal({ title: err.data?.code === 'full' ? 'Séance complète' : 'Inscription impossible', icon: err.data?.code === 'full' ? '🚫' : '⚠️', tone: 'warn', body: err.message });
    return false;
  }
}

/** Fenêtre « licence » quand la réservation est bloquée */
export async function licenseBlocked(message) {
  const v = await modal({
    title: 'Réservation bloquée', icon: '🪪', tone: 'danger', body: message,
    actions: [
      { label: 'Fermer', value: null, cls: 'ghost' },
      { label: 'Mettre à jour mon profil', value: 'profile', cls: 'secondary' },
      { label: 'Renouveler ma licence', value: 'renew' },
    ],
  });
  if (v === 'renew') window.open(state.config.licenseRenewUrl, '_blank', 'noopener');
  if (v === 'renew' || v === 'profile') location.hash = '#/profil';
}

/** Réservation en un clic */
export async function bookFlow(slotId) {
  try {
    const { slot } = await api(`/slots/${slotId}/book`, { method: 'POST' });
    modal({
      title: 'Réservation confirmée !', icon: '⛵', tone: 'success',
      body: html`<p>${slot.activity ? html`<strong>${slot.activity.name}${slot.label ? ` · ${slot.label}` : ''}</strong><br>` : ''}<strong>${fmtDay(slot.date)}</strong><br>${fmtH(slot.start)} – ${fmtH(slot.end)}</p>
        <p class="small muted">Un email de confirmation vous a été envoyé. Vous recevrez un rappel 24 h avant la séance.</p>`,
      actions: [{ label: 'Parfait !', value: true }],
    });
    return true;
  } catch (err) {
    if (err.data?.code === 'license') await licenseBlocked(err.message);
    else modal({ title: err.data?.code === 'full' ? 'Séance complète' : 'Réservation impossible', icon: err.data?.code === 'full' ? '🚫' : '⚠️', tone: 'warn', body: err.message });
    return false;
  }
}

const WARNING = 'Toute annulation doit être faite au minimum 24 h avant la séance.';

/**
 * Annulation avec avertissement systématique, puis alerte rouge si tardive.
 * doCancel(force) appelle l'API et renvoie { late, needsConfirm }.
 */
export async function cancelFlow(startsAt, doCancel) {
  const h = hoursUntil(startsAt);
  const first = await modal({
    title: 'Annuler cette réservation ?', icon: '⏰', tone: 'warn',
    body: html`<p><strong>${WARNING}</strong></p>${h >= 24 ? html`<p class="small muted">Votre séance est dans plus de 24 h : l'annulation est sans pénalité et la place sera libérée pour les autres membres.</p>` : ''}`,
    actions: [{ label: 'Retour', value: false, cls: 'secondary' }, { label: 'Annuler la séance', value: true, cls: 'danger' }],
  });
  if (!first) return false;
  try {
    let res = await doCancel(false);
    if (res.needsConfirm) {
      const late = await modal({
        title: 'Annulation tardive', icon: '🚨', tone: 'danger',
        body: html`<p><strong>Annulation tardive : vous risquez de perdre ce créneau.</strong></p>
          <p class="small">La séance commence dans moins de 24 h. Le gérant sera informé de cette annulation.</p>`,
        actions: [{ label: 'Garder ma réservation', value: false, cls: 'secondary' }, { label: 'Confirmer quand même', value: true, cls: 'danger' }],
      });
      if (!late) { toast('Votre réservation est conservée 👍'); return false; }
      res = await doCancel(true);
    }
    toast(res.late ? 'Annulation tardive enregistrée. Le gérant a été prévenu.' : 'Annulation confirmée : la place est libérée.', res.late ? '' : 'ok');
    return true;
  } catch (err) {
    modal({ title: 'Annulation impossible', icon: '⚠️', tone: 'warn', body: err.message });
    return false;
  }
}

export function licenseBanner(user, { compact = false } = {}) {
  const lic = user.license;
  if (!lic || lic.status === 'valid') return '';
  const renew = html`<a class="btn ${lic.status === 'soon' ? 'sand' : 'danger'} sm" href="${state.config.licenseRenewUrl}" target="_blank" rel="noopener" data-renew>Renouveler ma licence</a>`;
  if (lic.status === 'expired' || lic.status === 'missing') {
    return html`<div class="banner bad" role="alert"><span class="ico">⛔</span><div>
      <strong>${lic.status === 'missing' ? 'Aucune licence enregistrée' : 'Votre licence est expirée'}</strong>
      La réservation des séances est bloquée tant que votre licence n'est pas renouvelée et mise à jour dans votre profil.
      ${compact ? '' : html`<br>`}${renew}</div></div>`;
  }
  return html`<div class="banner ${lic.status === 'urgent' ? 'bad' : 'warn'}" role="status"><span class="ico">⏳</span><div>
    <strong>Votre licence expire dans ${lic.daysLeft} jour${lic.daysLeft > 1 ? 's' : ''}</strong>
    Pensez à la renouveler pour continuer à réserver vos séances.<br>${renew}</div></div>`;
}

export const emptyState = (emoji, text, extra = '') => html`<div class="empty"><span class="big">${emoji}</span><p>${text}</p>${extra}</div>`;
export { raw, esc };

/** Filtre par activité (mémorisé sur l'appareil) */
export function activityFilter(selected) {
  const acts = state.config.activities || [];
  if (acts.length < 2) return '';
  return html`<div class="act-filter" role="group" aria-label="Filtrer par activité">
    <button type="button" class="chip" data-act="" aria-pressed="${!selected}">Toutes</button>
    ${acts.map((a) => html`<button type="button" class="chip" data-act="${a.id}" aria-pressed="${String(a.id) === String(selected)}" style="--chip:${safeColor(a.color)}">${a.name}</button>`)}
  </div>`;
}
export const filterByActivity = (slots, selected) => (selected ? slots.filter((s) => String(s.activity?.id) === String(selected)) : slots);
export const savedActivity = (key) => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
export const saveActivity = (key, v) => { try { localStorage.setItem(key, v); } catch { /* stockage indisponible */ } };
/** Fait défiler le filtre pour montrer l'activité choisie */
export function revealActiveChip(root) {
  const chip = root.querySelector('.act-filter [aria-pressed="true"]');
  if (chip) chip.parentElement.scrollLeft = chip.offsetLeft - chip.parentElement.offsetLeft - 16;
}
