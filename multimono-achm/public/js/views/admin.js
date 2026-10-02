import { api, state, html, mount, $, $$, icon, modal, toast, busy, formData, showError, levelBadge, licenseBadge, safeColor,
  today, addDays, mondayOf, fmtDay, fmtFull, fmtH, fmtDateTime, initials, go } from '../lib.js';
import { placesBar, emptyState } from './shared.js';
import { autoRefresh, weekNav, dayStrip, dayGroups, logout } from './member.js';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const WEEKDAYS_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

async function reloadConfig() {
  state.config = await api('/public/config');
  window.dispatchEvent(new Event('app:chrome'));
}

/** Carte séance côté gérant (cliquable vers la liste des inscrits) */
function adminSlotCard(s, { showDate = false } = {}) {
  return html`<article class="slot ${s.past ? 'past' : ''}" style="--slot-color:${safeColor(s.level?.color)}">
    <a class="slot-link" href="#/admin/seance/${s.id}">
      <div class="slot-head">
        <div>${showDate ? html`<div class="small muted" style="font-weight:700">${fmtDay(s.date)}</div>` : ''}
          <div class="slot-time">${fmtH(s.start)} <small>– ${fmtH(s.end)}</small></div></div>
        ${levelBadge(s.level)}
      </div>
      ${placesBar(s)}
      <div class="row between small"><span class="muted">${s.location || ''}</span><span style="color:var(--ocean);font-weight:700">Voir les inscrits ›</span></div>
    </a>
  </article>`;
}

// ══════════ Tableau de bord ══════════
export async function dashboard(root) {
  async function load() {
    const d = await api('/admin/dashboard');
    const expired = d.expiring.filter((m) => m.license.status === 'expired');
    mount(root, html`
      <div class="page-head"><div><p class="muted" style="margin:0">Bonjour ${state.user.firstName} 👋</p><h1>Tableau de bord</h1></div>
        <a class="btn sm" href="#/admin/seance/nouvelle">${icon('plus')} Nouvelle séance</a></div>
      <div class="stats">
        <a class="stat" href="#/admin/seances"><span class="num">${d.todaySlots.length}</span><span class="lbl">Séance${d.todaySlots.length > 1 ? 's' : ''} aujourd'hui</span></a>
        <a class="stat fill" href="#/admin/seances">
          <div class="ring" style="--p:${d.fillRate}"><b>${d.fillRate}%</b></div>
          <span class="lbl">Remplissage de la semaine<br><b style="color:var(--abyss)">${d.weekBooked}/${d.weekCapacity} places</b></span></a>
        <a class="stat ${d.expiring.length ? 'alert' : ''}" href="#/admin/membres?license=soon"><span class="num">${d.expiring.length}</span><span class="lbl">Licence${d.expiring.length > 1 ? 's' : ''} à surveiller (30 j)</span></a>
        <a class="stat ${d.lateCount ? 'alert' : ''}" href="#/admin/annulations"><span class="num">${d.lateCount}</span><span class="lbl">Annulation${d.lateCount > 1 ? 's' : ''} tardive${d.lateCount > 1 ? 's' : ''} (30 j)</span></a>
      </div>

      <div class="two-cols">
        <section>
          <div class="card-title"><h2>Aujourd'hui · ${fmtDay(d.today, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>
          ${d.todaySlots.length ? d.todaySlots.map((s) => adminSlotCard(s)) : emptyState('🏝️', 'Pas de séance aujourd\'hui.')}

          <div class="card-title" style="margin-top:18px"><h2>Cette semaine</h2><a class="small" href="#/admin/seances">Calendrier ›</a></div>
          ${d.weekSlots.length ? html`<div class="card"><div class="list">${d.weekSlots.map((s) => html`
            <a class="item" href="#/admin/seance/${s.id}" style="box-shadow:none;padding:8px 4px">
              <div class="grow"><div class="name">${fmtDay(s.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtH(s.start)}</div>
                <div class="bar ${s.booked / s.capacity >= .8 ? 'high' : ''}" style="margin-top:6px"><span style="width:${Math.round((s.booked / s.capacity) * 100)}%"></span></div></div>
              <span class="badge ${s.full ? 'full' : ''}">${s.booked}/${s.capacity}</span>${icon('right', 'class="chev"')}</a>`)}</div></div>`
    : emptyState('📅', 'Aucune séance cette semaine.', html`<a class="btn" href="#/admin/seance/nouvelle">Créer des séances</a>`)}
        </section>
        <section>
          <div class="card-title"><h2>Licences à surveiller</h2><a class="small" href="#/admin/membres">Membres ›</a></div>
          ${expired.length ? html`<div class="banner bad"><span class="ico">⛔</span><div><strong>${expired.length} licence${expired.length > 1 ? 's' : ''} expirée${expired.length > 1 ? 's' : ''}</strong>Ces membres ne peuvent plus réserver.</div></div>` : ''}
          ${d.expiring.length ? html`<div class="list">${d.expiring.map((m) => memberItem(m))}</div>` : emptyState('✅', 'Toutes les licences sont valides pour les 30 prochains jours.')}
        </section>
      </div>`);
  }
  autoRefresh(root, load, 60000);
  await load();
}

function memberItem(m, extra = '') {
  return html`<a class="item" href="#/admin/membre/${m.id}">
    <div class="avatar" style="--avatar:${safeColor(m.level?.color || '#0e7490')}">${initials(m)}</div>
    <div class="grow"><div class="name">${m.lastName.toUpperCase()} ${m.firstName}</div>
      <div class="row" style="gap:6px;margin-top:4px">${levelBadge(m.level)} ${licenseBadge(m.license)} ${extra}</div></div>
    ${icon('right', 'class="chev"')}</a>`;
}

// ══════════ Calendrier des séances ══════════
const acal = { mode: 'week', day: null };
export async function slots(root) {
  if (!acal.day) acal.day = today();
  let list = [];
  async function load() {
    const monday = mondayOf(acal.day);
    ({ slots: list } = await api(`/slots?from=${monday}&to=${addDays(monday, 6)}`));
    render();
  }
  function render() {
    const monday = mondayOf(acal.day);
    const daySlots = list.filter((s) => s.date === acal.day);
    mount(root, html`
      <div class="page-head"><h1>Séances</h1></div>
      <div class="cal-toolbar">
        <div class="segmented" role="group" aria-label="Affichage">
          <button data-mode="week" aria-pressed="${acal.mode === 'week'}">Semaine</button>
          <button data-mode="day" aria-pressed="${acal.mode === 'day'}">Jour</button>
        </div>
        ${weekNav(monday)}
        ${acal.mode === 'day' ? dayStrip(monday, acal.day, list) : ''}
      </div>
      ${acal.mode === 'day'
    ? html`<h2 style="margin:4px 4px 10px">${fmtDay(acal.day)}</h2>${daySlots.length ? daySlots.map((s) => adminSlotCard(s)) : emptyState('🏝️', 'Aucune séance ce jour-là.', html`<a class="btn" href="#/admin/seance/nouvelle?date=${acal.day}">Créer une séance ce jour</a>`)}`
    : dayGroups(monday, list, (s) => adminSlotCard(s))}
      <a class="btn fab" href="#/admin/seance/nouvelle${acal.mode === 'day' ? `?date=${acal.day}` : ''}" aria-label="Nouvelle séance">${icon('plus')}</a>`);
  }
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.mode) { acal.mode = t.dataset.mode; render(); }
    else if (t.dataset.week) { acal.day = addDays(mondayOf(acal.day), 7 * Number(t.dataset.week)); await load(); }
    else if (t.dataset.today !== undefined) { acal.day = today(); await load(); }
    else if (t.dataset.day) { acal.day = t.dataset.day; render(); }
  });
  autoRefresh(root, load);
  await load();
}

// ══════════ Création / modification d'une séance ══════════
export async function slotForm(root, id) {
  const levels = state.config.levels;
  let slot = null;
  if (id) ({ slot } = await api(`/admin/slots/${id}`));
  const tpl = id ? [] : JSON.parse((await api('/admin/settings')).weekly_template || '[]');
  const qDate = new URLSearchParams(location.hash.split('?')[1] || '').get('date');
  const d0 = slot?.date || qDate || today();
  const last = JSON.parse(localStorage.getItem('lastSlot') || '{}');
  const v = slot || { start: last.start || '09:00', end: last.end || '11:00', capacity: last.capacity || 6, level: null, location: '', notes: '' };

  mount(root, html`
    <div class="page-head"><h1>${slot ? 'Modifier la séance' : 'Nouvelle séance'}</h1></div>
    ${slot && slot.booked ? html`<div class="banner info"><span class="ico">📣</span><div><strong>${slot.booked} participant${slot.booked > 1 ? 's' : ''} inscrit${slot.booked > 1 ? 's' : ''}</strong>Ils recevront automatiquement une notification (app + email) si vous modifiez la date, l'horaire, le niveau ou le lieu.</div></div>` : ''}
    <form class="card form" id="f" novalidate>
      ${slot ? '' : html`<div class="segmented" role="group" aria-label="Type de séance" style="justify-self:start">
        <button type="button" data-kind="single" aria-pressed="true">Unique</button>
        <button type="button" data-kind="recurring" aria-pressed="false">Récurrente</button>
        <button type="button" data-kind="template" aria-pressed="false">Planning habituel</button></div>`}

      <div id="template" class="form hidden">
        <div class="banner info" style="margin:0"><span class="ico">🗓️</span><div><strong>Planning habituel du club</strong>
          ${tpl.length ? html`<ul style="margin:6px 0 0;padding-left:18px">${tpl.map((t) => html`<li>${WEEKDAYS_LONG[t.weekday]} ${fmtH(t.start)} – ${fmtH(t.end)} · ${t.capacity} places</li>`)}</ul>` : 'Aucun créneau défini.'}
          <a class="small" href="#/admin/reglages">Modifier le planning habituel ›</a></div></div>
        <div class="form-grid two">
          <div class="field"><label for="tfrom">Du</label><input id="tfrom" name="tfrom" type="date" value="${d0}"></div>
          <div class="field"><label for="tuntil">Au</label><input id="tuntil" name="tuntil" type="date" value="${addDays(d0, 56)}"></div>
        </div>
        <p class="small muted">Les séances déjà existantes au même horaire ne sont pas recréées.</p>
      </div>

      <div id="single" class="field"><label for="date">Date</label><input id="date" name="date" type="date" value="${d0}" required></div>

      <div id="recurring" class="form hidden">
        <div class="field"><span class="label">Jours de pratique</span>
          <div class="chips" id="weekdays">${WEEKDAYS.map((w, i) => html`<button type="button" class="chip" data-wd="${i}" aria-pressed="false">${w}</button>`)}</div></div>
        <div class="form-grid two">
          <div class="field"><label for="from">Du</label><input id="from" name="from" type="date" value="${d0}"></div>
          <div class="field"><label for="until">Au</label><input id="until" name="until" type="date" value="${addDays(d0, 56)}"></div>
        </div>
        <p class="small muted" id="count"></p>
      </div>

      <div class="form-grid two slot-fields">
        <div class="field"><label for="start">Début</label><input id="start" name="start" type="time" value="${v.start}" step="300" required></div>
        <div class="field"><label for="end">Fin</label><input id="end" name="end" type="time" value="${v.end}" step="300" required></div>
      </div>
      <div class="form-grid two slot-fields">
        <div class="field"><label for="capacity">Nombre de places</label><input id="capacity" name="capacity" type="number" inputmode="numeric" min="${slot?.booked || 1}" max="500" value="${v.capacity}" required></div>
        <div class="field"><label for="levelId">Niveau requis</label>
          <select id="levelId" name="levelId"><option value="">Tous niveaux</option>
            ${levels.map((l) => html`<option value="${l.id}" ${v.level?.id === l.id ? 'selected' : ''}>${l.name}</option>`)}</select></div>
      </div>
      <div class="field"><label for="location">Lieu</label><input id="location" name="location" value="${v.location || ''}" placeholder="${state.config.defaultLocation}"></div>
      <div class="field slot-fields"><label for="notes">Remarque (optionnel)</label><input id="notes" name="notes" value="${v.notes || ''}" placeholder="Ex. : prévoir combinaison"></div>
      <button class="btn lg block" type="submit">${slot ? 'Enregistrer les modifications' : 'Créer'}</button>
      <a class="btn ghost block" href="${slot ? `#/admin/seance/${slot.id}` : '#/admin/seances'}">Annuler</a>
    </form>`);

  const f = $('#f', root);
  let kind = 'single';
  const wd = new Set();
  const updateCount = () => {
    if (kind !== 'recurring') return;
    let n = 0;
    if (f.from.value && f.until.value && wd.size) {
      for (let d = f.from.value; d <= f.until.value && n < 1000; d = addDays(d, 1)) if (wd.has((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7)) n++;
    }
    $('#count', root).textContent = wd.size ? `${n} séance${n > 1 ? 's' : ''} seront créées.` : 'Choisissez au moins un jour.';
  };
  $$('[data-kind]', root).forEach((b) => b.addEventListener('click', () => {
    kind = b.dataset.kind;
    $$('[data-kind]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('#single', root).classList.toggle('hidden', kind !== 'single');
    $('#recurring', root).classList.toggle('hidden', kind !== 'recurring');
    $('#template', root).classList.toggle('hidden', kind !== 'template');
    $$('.slot-fields', root).forEach((el) => el.classList.toggle('hidden', kind === 'template'));
    f.querySelector('[type=submit]').textContent = kind === 'single' ? 'Créer' : 'Créer les séances';
    updateCount();
  }));
  $$('[data-wd]', root).forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.wd);
    if (wd.has(i)) wd.delete(i); else wd.add(i);
    b.setAttribute('aria-pressed', String(wd.has(i)));
    updateCount();
  }));
  f.from.addEventListener('change', updateCount);
  f.until.addEventListener('change', updateCount);

  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = { ...formData(f), recurring: kind === 'recurring', weekdays: [...wd].sort() };
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        if (kind === 'template') {
          const r = await api('/admin/slots/template', { method: 'POST', body: { from: data.tfrom, until: data.tuntil, location: data.location } });
          toast(`${r.created} séance${r.created > 1 ? 's' : ''} créée${r.created > 1 ? 's' : ''}${r.skipped ? ` (${r.skipped} déjà existante${r.skipped > 1 ? 's' : ''})` : ''} ✅`, 'ok');
          acal.day = data.tfrom;
          location.hash = '#/admin/seances';
          return;
        }
        localStorage.setItem('lastSlot', JSON.stringify({ start: data.start, end: data.end, capacity: data.capacity }));
        if (slot) {
          const r = await api(`/admin/slots/${slot.id}`, { method: 'PUT', body: data });
          toast(r.notified ? `Séance modifiée — ${r.notified} participant(s) prévenu(s).` : 'Séance modifiée ✅', 'ok');
          location.hash = `#/admin/seance/${slot.id}`;
        } else {
          const r = await api('/admin/slots', { method: 'POST', body: data });
          toast(`${r.created} séance${r.created > 1 ? 's' : ''} créée${r.created > 1 ? 's' : ''} ✅`, 'ok');
          acal.day = data.recurring ? data.from : data.date;
          location.hash = '#/admin/seances';
        }
      } catch (err) { showError(f, err); }
    });
  });
}

// ══════════ Détail d'une séance : inscrits ══════════
export async function slotDetail(root, id) {
  const { slot: s, participants, guests, cancellations, seriesCount } = await api(`/admin/slots/${id}`);
  const lateCount = cancellations.filter((c) => c.status === 'late_cancelled').length;
  // Liste numérotée des places (comme la feuille « Inscription Multimono ») : membres, puis invités / groupes, puis places libres
  const rows = [
    ...participants.map((p) => ({ kind: 'member', p })),
    ...guests.flatMap((g) => Array.from({ length: g.places }, (_, i) => ({ kind: 'guest', g, first: i === 0 }))),
  ];
  while (rows.length < s.capacity) rows.push({ kind: 'free' });

  const row = (r, n) => {
    const num = html`<div class="avatar" style="--avatar:${r.kind === 'free' ? '#cbd5e1' : r.kind === 'guest' ? 'var(--sand-ink)' : safeColor(r.p.level?.color || '#0e7490')}">${n}</div>`;
    if (r.kind === 'free') {
      return html`<div class="item" style="box-shadow:none;border:1px dashed var(--line);background:var(--foam)">${num}
        <div class="grow muted">Place libre</div></div>`;
    }
    if (r.kind === 'guest') {
      return html`<div class="item" style="box-shadow:none;border:1px solid var(--sand-2);background:#fffaf0">${num}
        <div class="grow"><div class="name">${r.g.name}</div>
          <div class="row" style="gap:6px;margin-top:4px"><span class="badge sand">${r.g.places > 1 ? `Groupe · ${r.g.places} places` : 'Invité'}</span>
            ${r.g.phone ? html`<a class="small" href="tel:${r.g.phone}">${r.g.phone}</a>` : ''}</div>
          ${r.g.note && r.first ? html`<div class="sub">${r.g.note}</div>` : ''}</div>
        ${r.first && !s.past ? html`<button class="round-btn" data-del-guest="${r.g.id}" data-name="${r.g.name}" aria-label="Retirer ${r.g.name}">${icon('x')}</button>` : ''}</div>`;
    }
    const p = r.p;
    return html`<div class="item" style="box-shadow:none;border:1px solid var(--line)">${num}
      <div class="grow">
        <a class="name" href="#/admin/membre/${p.id}" style="text-decoration:none">${p.firstName} ${p.lastName.toUpperCase()}</a>
        <div class="row" style="gap:6px;margin-top:4px">${levelBadge(p.level)} ${licenseBadge(p.sessionLicense)}
          ${p.presenceConfirmed ? html`<span class="badge ok">✓ Présence confirmée</span>` : ''}</div>
        <div class="sub" style="margin-top:4px">Urgence : ${p.emergencyName} · <a href="tel:${p.emergencyPhone}">${p.emergencyPhone}</a></div>
      </div>
      <div class="row" style="gap:6px;flex-wrap:nowrap">
        <a class="round-btn" href="tel:${p.phone}" aria-label="Appeler ${p.firstName}">${icon('phone')}</a>
        ${s.past ? '' : html`<button class="round-btn" data-del-booking="${p.bookingId}" data-name="${p.firstName} ${p.lastName}" aria-label="Retirer ${p.firstName}">${icon('x')}</button>`}
      </div></div>`;
  };

  mount(root, html`
    <div class="page-head"><div><a class="small" href="#/admin/seances">‹ Séances</a><h1>${fmtDay(s.date)}</h1></div></div>
    <div class="card" style="border-left:6px solid ${safeColor(s.level?.color)}">
      <div class="slot-head"><div class="slot-time">${fmtH(s.start)} <small>– ${fmtH(s.end)}</small></div>${levelBadge(s.level)}</div>
      <dl class="kv" style="margin:12px 0">
        <dt>Lieu</dt><dd>${s.location || state.config.defaultLocation}</dd>
        ${s.notes ? html`<dt>Remarque</dt><dd>${s.notes}</dd>` : ''}
        ${s.seriesId ? html`<dt>Récurrence</dt><dd>Fait partie d'une série (${seriesCount} séance${seriesCount > 1 ? 's' : ''} à partir de celle-ci)</dd>` : ''}
      </dl>
      ${placesBar(s)}
      ${s.past ? '' : html`<div class="btn-row" style="margin-top:14px">
        <a class="btn secondary" href="#/admin/seance/${s.id}/modifier">${icon('edit')} Modifier</a>
        <button class="btn danger-outline" id="del">${icon('trash')} Supprimer</button></div>`}
    </div>

    <div class="card">
      <div class="card-title"><h2>Inscrits (${s.booked}/${s.capacity})</h2>
        ${participants.length ? html`<span class="small muted">${participants.filter((p) => p.presenceConfirmed).length} présence(s) confirmée(s)</span>` : ''}</div>
      <div class="list">${rows.map((r, i) => row(r, i + 1))}</div>
      ${s.past || s.full ? '' : html`<div class="btn-row" style="margin-top:14px">
        <button class="btn secondary" id="add-member">${icon('plus')} Inscrire un membre</button>
        <button class="btn sand" id="add-guest">${icon('plus')} Invité / groupe</button></div>`}
    </div>

    ${cancellations.length ? html`<div class="card">
      <h2>Annulations ${lateCount ? html`<span class="badge bad">${lateCount} tardive${lateCount > 1 ? 's' : ''}</span>` : ''}</h2>
      <div class="list">${cancellations.map((c) => html`<div class="row between small">
        <span>${c.first_name} ${c.last_name.toUpperCase()}</span>
        <span>${c.status === 'late_cancelled' ? html`<span class="badge bad">Tardive</span>` : html`<span class="badge">À temps</span>`} <span class="muted">${fmtDateTime(c.cancelled_at)}</span></span></div>`)}</div>
    </div>` : ''}`);

  const reload = () => go(location.hash);

  $('#add-member', root)?.addEventListener('click', async () => {
    let chosen = null;
    const ok = await modal({
      title: 'Inscrire un membre', icon: '👤', left: true,
      body: html`<p class="small muted">Pour un membre qui s'inscrit par téléphone ou en direct. Il recevra la confirmation par email.</p>
        <input type="search" id="msearch" placeholder="Rechercher un membre…" aria-label="Rechercher un membre">
        <div class="list" id="mresults" style="margin-top:10px;max-height:40vh;overflow:auto"></div>`,
      actions: [{ label: 'Annuler', value: false, cls: 'secondary' }, { label: 'Inscrire', value: true }],
      onOpen(m) {
        const input = $('#msearch', m); const out = $('#mresults', m);
        const already = new Set(participants.map((p) => p.id));
        let t;
        const search = async () => {
          const { members: list } = await api(`/admin/members?q=${encodeURIComponent(input.value.trim())}`);
          mount(out, html`${list.slice(0, 30).map((mb) => html`<label class="check" style="padding:10px">
            <input type="radio" name="pick" value="${mb.id}" ${already.has(mb.id) ? 'disabled' : ''}>
            <span><strong>${mb.firstName} ${mb.lastName}</strong> ${levelBadge(mb.level)} ${licenseBadge(mb.license)}${already.has(mb.id) ? html` <span class="small muted">déjà inscrit</span>` : ''}</span></label>`)}`);
          $$('input[name=pick]', out).forEach((r) => r.addEventListener('change', () => { chosen = Number(r.value); }));
        };
        input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(search, 200); });
        search(); setTimeout(() => input.focus(), 50);
      },
    });
    if (!ok) return;
    if (!chosen) { toast('Choisissez un membre dans la liste.', 'bad'); return; }
    try { await api(`/admin/slots/${s.id}/participants`, { method: 'POST', body: { userId: chosen } }); toast('Membre inscrit ✅', 'ok'); reload(); } catch (err) { toast(err.message, 'bad'); }
  });

  $('#add-guest', root)?.addEventListener('click', async () => {
    let gf = null;
    const ok = await modal({
      title: 'Invité ou groupe', icon: '🧑‍🤝‍🧑', left: true,
      body: html`<form class="form" id="gform">
        <p class="small muted">Réservez une ou plusieurs places pour une personne sans compte (invité, découverte, groupe…).</p>
        <div class="field"><label for="gname">Nom</label><input id="gname" name="name" required maxlength="80"></div>
        <div class="field"><label for="gplaces">Nombre de places (${s.remaining} libre${s.remaining > 1 ? 's' : ''})</label>
          <input id="gplaces" name="places" type="number" inputmode="numeric" min="1" max="${s.remaining}" value="1"></div>
        <div class="field"><label for="gphone">Téléphone (optionnel)</label><input id="gphone" name="phone" type="tel"></div>
        <div class="field"><label for="gnote">Remarque (optionnel)</label><input id="gnote" name="note" maxlength="200"></div></form>`,
      actions: [{ label: 'Annuler', value: false, cls: 'secondary' }, { label: 'Réserver les places', value: true }],
      onOpen(m) {
        gf = $('#gform', m);
        gf.addEventListener('submit', (ev) => ev.preventDefault());
        setTimeout(() => $('#gname', m).focus(), 50);
      },
    });
    const values = gf ? formData(gf) : null;
    if (!ok || !values?.name?.trim()) { if (ok) toast('Indiquez un nom.', 'bad'); return; }
    try { await api(`/admin/slots/${s.id}/guests`, { method: 'POST', body: values }); toast('Places réservées ✅', 'ok'); reload(); } catch (err) { toast(err.message, 'bad'); }
  });

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del-booking], [data-del-guest]');
    if (!b) return;
    const isGuest = b.dataset.delGuest !== undefined;
    const ok = await modal({
      title: `Retirer ${b.dataset.name} ?`, icon: '🗑️', tone: 'danger',
      body: isGuest ? 'Les places seront libérées.' : 'La place sera libérée et le membre prévenu (notification + email). Aucune pénalité ne sera comptée.',
      actions: [{ label: 'Garder', value: false, cls: 'secondary' }, { label: 'Retirer', value: true, cls: 'danger' }],
    });
    if (!ok) return;
    try {
      await api(isGuest ? `/admin/guests/${b.dataset.delGuest}` : `/admin/bookings/${b.dataset.delBooking}`, { method: 'DELETE' });
      toast('Place libérée.', 'ok'); reload();
    } catch (err) { toast(err.message, 'bad'); }
  });

  $('#del', root)?.addEventListener('click', async () => {
    const actions = [{ label: 'Garder', value: null, cls: 'secondary' }, { label: 'Supprimer cette séance', value: 'one', cls: 'danger' }];
    if (s.seriesId && seriesCount > 1) actions.push({ label: `Supprimer celle-ci et les ${seriesCount - 1} suivantes`, value: 'series', cls: 'danger' });
    const choice = await modal({
      title: 'Supprimer la séance ?', icon: '🗑️', tone: 'danger', actions,
      body: participants.length ? html`<p><strong>${participants.length} participant${participants.length > 1 ? 's' : ''} inscrit${participants.length > 1 ? 's' : ''}</strong> ser${participants.length > 1 ? 'ont' : 'a'} automatiquement prévenu${participants.length > 1 ? 's' : ''} par notification et email.</p>${guests.length ? html`<p class="small">Pensez à prévenir vous-même les invités sans compte.</p>` : ''}` : guests.length ? 'Pensez à prévenir vous-même les invités sans compte.' : 'Aucun participant inscrit.',
    });
    if (!choice) return;
    try {
      const r = await api(`/admin/slots/${s.id}${choice === 'series' ? '?scope=series' : ''}`, { method: 'DELETE' });
      toast(`${r.deleted} séance(s) supprimée(s)${r.notified ? ` — ${r.notified} notification(s) envoyée(s)` : ''}.`, 'ok');
      location.hash = '#/admin/seances';
    } catch (err) { toast(err.message, 'bad'); }
  });
}

// ══════════ Membres ══════════
export async function members(root) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const filters = { level: params.get('level') || '', license: params.get('license') || '', q: '' };
  const qs = () => new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();

  mount(root, html`
    <div class="page-head"><h1>Membres</h1><a class="btn sm secondary" id="csv" href="#">${icon('download')} Export CSV</a></div>
    <div class="card form" style="gap:10px">
      <input type="search" id="q" placeholder="Rechercher (nom, email, n° licence)…" aria-label="Rechercher">
      <div class="form-grid two">
        <select id="level" aria-label="Filtrer par niveau"><option value="">Tous les niveaux</option>
          ${state.config.levels.map((l) => html`<option value="${l.id}" ${String(l.id) === filters.level ? 'selected' : ''}>${l.name}</option>`)}</select>
        <select id="license" aria-label="Filtrer par licence">
          <option value="">Toutes les licences</option>
          <option value="valid" ${filters.license === 'valid' ? 'selected' : ''}>Licence valide</option>
          <option value="soon" ${filters.license === 'soon' ? 'selected' : ''}>Expire sous 30 jours</option>
          <option value="expired" ${filters.license === 'expired' ? 'selected' : ''}>Licence expirée / absente</option>
        </select>
      </div>
    </div>
    <div id="results"></div>`);

  async function load() {
    const { members: list } = await api(`/admin/members?${qs()}`);
    $('#csv', root).href = `/api/admin/members.csv?${qs()}`;
    mount($('#results', root), html`
      <p class="small muted">${list.length} membre${list.length > 1 ? 's' : ''}</p>
      ${list.length ? html`<div class="list">${list.map((m) => memberItem(m, m.lateCount ? html`<span class="badge bad">${m.lateCount} annul. tardive${m.lateCount > 1 ? 's' : ''}</span>` : ''))}</div>`
    : emptyState('🔎', 'Aucun membre ne correspond à ces filtres.')}`);
  }
  let timer;
  $('#q', root).addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { filters.q = e.target.value.trim(); load(); }, 250); });
  $('#level', root).addEventListener('change', (e) => { filters.level = e.target.value; load(); });
  $('#license', root).addEventListener('change', (e) => { filters.license = e.target.value; load(); });
  await load();
}

export async function memberDetail(root, id) {
  const { member: m, upcoming, late } = await api(`/admin/members/${id}`);
  mount(root, html`
    <div class="page-head"><div><a class="small" href="#/admin/membres">‹ Membres</a><h1>${m.firstName} ${m.lastName}</h1></div></div>
    <div class="row" style="margin-bottom:14px">${levelBadge(m.level)} ${licenseBadge(m.license)}</div>
    <div class="two-cols">
      <div class="card"><h2>Carte d'inscription</h2>
        <dl class="kv">
          <dt>Né(e) le</dt><dd>${fmtFull(m.birthDate)}</dd>
          <dt>Téléphone</dt><dd><a href="tel:${m.phone}">${m.phone}</a></dd>
          <dt>Email</dt><dd><a href="mailto:${m.email}">${m.email}</a></dd>
          <dt>Urgence</dt><dd>${m.emergencyName}<br><a href="tel:${m.emergencyPhone}">${m.emergencyPhone}</a></dd>
          <dt>N° licence</dt><dd>${m.licenseNumber || '—'}</dd>
          <dt>Obtenue le</dt><dd>${fmtFull(m.licenseObtained)}</dd>
          <dt>Expire le</dt><dd>${fmtFull(m.licenseExpires)}</dd>
          <dt>Règlement</dt><dd>Accepté le ${fmtFull(m.rulesAcceptedAt?.slice(0, 10))}</dd>
          <dt>Inscrit(e) le</dt><dd>${fmtFull(m.createdAt.slice(0, 10))}</dd>
        </dl>
      </div>
      <div>
        <form class="card form" id="lvl"><h2>Niveau de navigation</h2>
          <select name="levelId" aria-label="Niveau"><option value="">— Non renseigné —</option>
            ${state.config.levels.map((l) => html`<option value="${l.id}" ${m.level?.id === l.id ? 'selected' : ''}>${l.name}</option>`)}</select>
          <button class="btn secondary block" type="submit">Mettre à jour le niveau</button></form>
        <div class="card"><h2>Séances à venir (${upcoming.length})</h2>
          ${upcoming.length ? html`<div class="list">${upcoming.map((s) => html`<a class="item" href="#/admin/seance/${s.id}" style="box-shadow:none;border:1px solid var(--line)">
            <div class="grow"><div class="name">${fmtDay(s.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtH(s.start)}</div></div>${levelBadge(s.level)}</a>`)}</div>` : html`<p class="muted">Aucune.</p>`}</div>
        <div class="card"><h2>Annulations tardives (${late.length})</h2>
          ${late.length ? html`<div class="list">${late.map((l) => html`<div class="small"><strong>${l.slot_label}</strong><br><span class="muted">Annulée ${l.hours_before.toFixed(1).replace('.', ',')} h avant · ${fmtDateTime(l.cancelled_at)}</span></div>`)}</div>` : html`<p class="muted">Aucune 👍</p>`}</div>
        <button class="btn danger-outline block" id="del">${icon('trash')} Supprimer ce membre</button>
      </div>
    </div>`);
  const f = $('#lvl', root);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(f.querySelector('button'), async () => {
      try { await api(`/admin/members/${m.id}/level`, { method: 'PUT', body: formData(f) }); toast('Niveau mis à jour ✅', 'ok'); go(location.hash); } catch (err) { toast(err.message, 'bad'); }
    });
  });
  $('#del', root).addEventListener('click', async () => {
    const ok = await modal({ title: 'Supprimer ce membre ?', icon: '🗑️', tone: 'danger', body: `Le compte de ${m.firstName} ${m.lastName} et ses réservations seront définitivement supprimés.`,
      actions: [{ label: 'Garder', value: false, cls: 'secondary' }, { label: 'Supprimer définitivement', value: true, cls: 'danger' }] });
    if (!ok) return;
    await api(`/admin/members/${m.id}`, { method: 'DELETE' });
    toast('Membre supprimé.', 'ok');
    location.hash = '#/admin/membres';
  });
}

// ══════════ Annulations tardives ══════════
export async function lateCancellations(root) {
  const { items } = await api('/admin/late-cancellations');
  mount(root, html`
    <div class="page-head"><div><a class="small" href="#/admin/plus">‹ Plus</a><h1>Annulations tardives</h1></div></div>
    <p class="muted">Annulations faites moins de 24 h avant le début de la séance.</p>
    ${items.length ? html`<div class="list">${items.map((l) => html`
      <div class="item">
        <div class="avatar" style="--avatar:var(--coral)">⚠️</div>
        <div class="grow">
          ${l.user_id ? html`<a class="name" href="#/admin/membre/${l.user_id}" style="text-decoration:none">${l.user_name}</a>` : html`<span class="name">${l.user_name}</span>`}
          <div class="sub">Séance : ${l.slot_label}</div>
          <div class="sub">Annulée le ${fmtDateTime(l.cancelled_at)} · <strong style="color:var(--danger)">${l.hours_before.toFixed(1).replace('.', ',')} h avant</strong></div>
        </div>
      </div>`)}</div>` : emptyState('👍', 'Aucune annulation tardive.')}`);
}

// ══════════ Niveaux ══════════
export async function levels(root) {
  const render = () => mount(root, html`
    <div class="page-head"><div><a class="small" href="#/admin/plus">‹ Plus</a><h1>Niveaux de navigation</h1></div></div>
    <p class="muted">La couleur de chaque niveau apparaît en badge sur le profil des participants et dans vos listes. L'ordre va du plus débutant au plus expérimenté.</p>
    <div class="list" id="list">${state.config.levels.map((l, i, arr) => html`
      <form class="card level-row" data-id="${l.id}" style="margin:0">
        <input type="color" name="color" value="${safeColor(l.color)}" aria-label="Couleur">
        <input name="name" value="${l.name}" aria-label="Nom du niveau" maxlength="40" required>
        <div class="level-actions">
          <button type="button" class="round-btn" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Monter">▲</button>
          <button type="button" class="round-btn" data-move="1" ${i === arr.length - 1 ? 'disabled' : ''} aria-label="Descendre">▼</button>
          <button type="submit" class="btn sm">Enregistrer</button>
          <button type="button" class="btn sm danger-outline" data-del>${icon('trash')}</button>
        </div>
      </form>`)}</div>
    <form class="card form" id="add" style="margin-top:16px"><h2>Ajouter un niveau</h2>
      <div class="swatch-row"><input type="color" name="color" value="#8b5cf6" aria-label="Couleur"><input name="name" placeholder="Nom du niveau (ex. : Régate)" maxlength="40" required></div>
      <button class="btn block" type="submit">${icon('plus')} Ajouter</button></form>`);

  render();
  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = formData(f);
    try {
      if (f.id === 'add') await api('/admin/levels', { method: 'POST', body });
      else await api(`/admin/levels/${f.dataset.id}`, { method: 'PUT', body });
      await reloadConfig(); render(); toast('Niveaux enregistrés ✅', 'ok');
    } catch (err) { toast(err.message, 'bad'); }
  });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    const row = b?.closest('[data-id]');
    if (!b || !row) return;
    const id = Number(row.dataset.id);
    if (b.dataset.move) {
      const ids = state.config.levels.map((l) => l.id);
      const i = ids.indexOf(id); const j = i + Number(b.dataset.move);
      [ids[i], ids[j]] = [ids[j], ids[i]];
      await api('/admin/levels/order', { method: 'PUT', body: { ids } });
      await reloadConfig(); render();
    } else if (b.dataset.del !== undefined) {
      const usage = await api(`/admin/levels/${id}/usage`);
      const name = state.config.levels.find((l) => l.id === id)?.name;
      const ok = await modal({ title: `Supprimer « ${name} » ?`, icon: '🗑️', tone: 'danger',
        body: usage.members || usage.slots ? `${usage.members} membre(s) et ${usage.slots} séance(s) à venir utilisent ce niveau : ils passeront en « non renseigné » / « tous niveaux ».` : 'Ce niveau n\'est utilisé par personne.',
        actions: [{ label: 'Garder', value: false, cls: 'secondary' }, { label: 'Supprimer', value: true, cls: 'danger' }] });
      if (!ok) return;
      await api(`/admin/levels/${id}`, { method: 'DELETE' });
      await reloadConfig(); render(); toast('Niveau supprimé.', 'ok');
    }
  });
}

// ══════════ Réglages ══════════
export async function settings(root) {
  const s = await api('/admin/settings');
  const u = state.user;
  mount(root, html`
    <div class="page-head"><div><a class="small" href="#/admin/plus">‹ Plus</a><h1>Réglages</h1></div></div>
    <div class="two-cols">
      <form class="card form" id="club"><h2>Le club</h2>
        <div class="field"><label for="club_name">Nom de l'application</label><input id="club_name" name="club_name" value="${s.club_name}" required></div>
        <div class="field"><label for="default_location">Lieu par défaut des séances</label><input id="default_location" name="default_location" value="${s.default_location}" required></div>
        <div class="field"><label for="license_renew_url">Lien « Renouveler ma licence »</label><input id="license_renew_url" name="license_renew_url" type="url" value="${s.license_renew_url}" required></div>
        <label class="check"><input type="checkbox" name="enforce_level" ${s.enforce_level === '1' ? 'checked' : ''}>
          <span><strong>Bloquer les réservations sous le niveau requis</strong><br><span class="small muted">Un participant ne pourra réserver que les séances de son niveau ou d'un niveau inférieur (selon l'ordre des niveaux).</span></span></label>
        <div class="field"><span class="label">Planning habituel</span>
          <span class="hint">Jour, début, fin, nombre de places. Créneaux types de la semaine, créés en un clic depuis « Nouvelle séance › Planning habituel ».</span>
          <div class="list" id="tpl"></div>
          <button type="button" class="btn ghost sm" id="tpl-add" style="justify-self:start">${icon('plus')} Ajouter un créneau type</button></div>
        <div class="field"><label for="rules_text">Règlement du club</label><textarea id="rules_text" name="rules_text" rows="10" required>${s.rules_text}</textarea></div>
        <button class="btn block" type="submit">Enregistrer</button>
      </form>
      <div>
        <form class="card form" id="me"><h2>Mon compte gérant</h2>
          <p class="small muted">Identifiant de connexion : <strong>${u.login}</strong></p>
          <div class="field"><label for="firstName">Prénom</label><input id="firstName" name="firstName" value="${u.firstName}" required></div>
          <div class="field"><label for="email">Email (reçoit les alertes)</label><input id="email" name="email" type="email" value="${/@multimono\.local$/.test(u.email) ? '' : u.email}" required></div>
          <div class="field"><label for="phone">Téléphone</label><input id="phone" name="phone" type="tel" value="${u.phone || ''}"></div>
          <button class="btn secondary block" type="submit">Enregistrer</button>
        </form>
        <form class="card form" id="pw"><h2>🔒 Mot de passe</h2>
          <div class="field"><label for="current">Mot de passe actuel</label><input id="current" name="current" type="password" autocomplete="current-password" required></div>
          <div class="field"><label for="next">Nouveau mot de passe</label><input id="next" name="next" type="password" autocomplete="new-password" minlength="8" required></div>
          <button class="btn secondary block" type="submit">Changer le mot de passe</button>
        </form>
      </div>
    </div>`);

  const bind = (fid, fn) => {
    const f = $(`#${fid}`, root);
    f.addEventListener('submit', (e) => { e.preventDefault(); busy(f.querySelector('[type=submit]'), async () => { try { await fn(formData(f), f); } catch (err) { showError(f, err); } }); });
  };
  // Planning habituel : lignes jour / début / fin / places
  const tplBox = $('#tpl', root);
  const tplRow = (t = { weekday: 5, start: '12:00', end: '14:30', capacity: 6 }) => html`
    <div class="tpl-row">
      <select data-k="weekday" aria-label="Jour">${WEEKDAYS_LONG.map((w, i) => html`<option value="${i}" ${i === t.weekday ? 'selected' : ''}>${w}</option>`)}</select>
      <input data-k="start" type="time" value="${t.start}" aria-label="Début">
      <input data-k="end" type="time" value="${t.end}" aria-label="Fin">
      <input data-k="capacity" type="number" min="1" value="${t.capacity}" aria-label="Places">
      <button type="button" class="round-btn" data-tpl-del aria-label="Supprimer ce créneau">${icon('x')}</button>
    </div>`;
  mount(tplBox, html`${JSON.parse(s.weekly_template || '[]').map(tplRow)}`);
  $('#tpl-add', root).addEventListener('click', () => tplBox.insertAdjacentHTML('beforeend', String(tplRow())));
  tplBox.addEventListener('click', (e) => e.target.closest('[data-tpl-del]')?.closest('.tpl-row').remove());
  const readTpl = () => $$('.tpl-row', tplBox).map((r) => ({
    weekday: Number($('[data-k=weekday]', r).value), start: $('[data-k=start]', r).value,
    end: $('[data-k=end]', r).value, capacity: Number($('[data-k=capacity]', r).value),
  }));

  bind('club', async (d) => { await api('/admin/settings', { method: 'PUT', body: { ...d, weekly_template: readTpl() } }); await reloadConfig(); toast('Réglages enregistrés ✅', 'ok'); });
  bind('me', async (d) => { state.user = (await api('/me', { method: 'PUT', body: d })).user; toast('Compte mis à jour ✅', 'ok'); });
  bind('pw', async (d, f) => { await api('/me/password', { method: 'PUT', body: d }); f.reset(); toast('Mot de passe modifié ✅', 'ok'); });
}

// ══════════ Menu « Plus » ══════════
export async function more(root) {
  const entries = [
    ['#/notifications', '🔔', 'Notifications', state.unread ? `${state.unread} non lue(s)` : 'Alertes et annulations'],
    ['#/admin/annulations', '⚠️', 'Annulations tardives', 'Historique complet'],
    ['#/admin/niveaux', '🎨', 'Niveaux de navigation', 'Noms, couleurs et ordre'],
    ['#/admin/reglages', '⚙️', 'Réglages', 'Club, règlement, mot de passe'],
  ];
  mount(root, html`
    <div class="page-head"><h1>Plus</h1></div>
    <div class="list menu-list">${entries.map(([h, ic, t, sub]) => html`
      <a class="item" href="${h}"><span class="ico">${ic}</span><div class="grow"><div class="name">${t}</div><div class="sub">${sub}</div></div>${icon('right', 'class="chev"')}</a>`)}
      <button class="item btn-reset" id="logout" style="border:0;font:inherit;text-align:left;cursor:pointer;width:100%"><span class="ico">👋</span><div class="grow"><div class="name">Se déconnecter</div></div></button>
    </div>`);
  $('#logout', root).addEventListener('click', logout);
}
