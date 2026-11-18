import { api, state, html, mount, $, $$, modal, busy, formData, showError, toast, levelBadge, fmtDay, fmtH, today } from '../lib.js';
import { cancelFlow, refreshUnread } from './shared.js';

const hero = (subtitle) => html`
  <div class="hero">
    <img src="/icons/icon.svg" alt="">
    <h1>${state.config.clubName}</h1>
    <p>${subtitle}</p>
  </div>`;

function afterLogin(user) {
  state.user = user;
  refreshUnread();
  const target = sessionStorage.getItem('afterLogin');
  sessionStorage.removeItem('afterLogin');
  location.hash = target && !/connexion|inscription/.test(target) ? target : user.role === 'admin' ? '#/admin' : '#/calendrier';
}

export async function login(root) {
  mount(root, html`
    <div class="auth-wrap">
      ${hero('Réservez vos séances de voile en un clic 🌊')}
      <form class="card form" id="f" novalidate>
        <div class="field"><label for="login">Email ou identifiant</label>
          <input id="login" name="login" type="text" autocomplete="username" inputmode="email" autocapitalize="none" placeholder="ex. : prenom.nom ou votre email" required></div>
        <div class="field"><label for="password">Mot de passe</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn lg block" type="submit">Se connecter</button>
        <a class="center small" href="#/mot-de-passe-oublie">Mot de passe oublié ?</a>
      </form>
      <div class="card center" style="border:2px solid var(--turquoise)">
        <h2>Déjà membre du club ?</h2>
        <p class="muted">Première fois dans l'application, ou Eric vous a donné un code d'accès : activez votre compte et choisissez votre mot de passe.</p>
        <a class="btn lg block" href="#/premiere-connexion">Première connexion / code d'accès</a>
      </div>
      <div class="card sand center">
        <h2>Nouveau au club ?</h2>
        <p class="muted">Remplissez votre carte d'inscription en 2 minutes.</p>
        <a class="btn sand lg block" href="#/inscription">Créer ma carte d'inscription</a>
      </div>
    </div>`);
  const f = $('#f', root);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(f.querySelector('[type=submit]'), async () => {
      const body = formData(f);
      try { afterLogin((await api('/auth/login', { method: 'POST', body })).user); } catch (err) {
        if (err.status === 300 && err.data?.choose) {
          // Email partagé par plusieurs membres d'une famille : lequel se connecte ?
          const id = await modal({ title: 'Qui se connecte ?', icon: '👨‍👩‍👧', body: 'Plusieurs membres utilisent cet email.',
            actions: [{ label: 'Annuler', value: null, cls: 'ghost' }, ...err.data.choose.map((c) => ({ label: `${c.firstName} ${c.lastName}`, value: c.id, cls: 'secondary' }))] });
          if (id) { try { afterLogin((await api('/auth/login', { method: 'POST', body: { ...body, userId: id } })).user); } catch (e2) { showError(f, e2); } }
        } else if (err.data?.code === 'pending') {
          const go2 = await modal({ title: 'Compte à activer', icon: '🔑', body: err.message,
            actions: [{ label: 'Fermer', value: false, cls: 'secondary' }, { label: 'Première connexion', value: true }] });
          if (go2) location.hash = '#/premiere-connexion';
        } else showError(f, err);
      }
    });
  });
}

export async function register(root) {
  const levels = state.config.levels;
  const t = today();
  mount(root, html`
    <div class="auth-wrap">
      ${hero('Carte d\'inscription du participant')}
      <form class="card form" id="f" novalidate>
        <div class="steps" aria-hidden="true"><span class="on" data-s="0"></span><span data-s="1"></span><span data-s="2"></span></div>

        <fieldset data-step="0" class="form">
          <legend>👤 Vos coordonnées</legend>
          <div class="form-grid two">
            <div class="field"><label for="lastName">Nom</label><input id="lastName" name="lastName" autocomplete="family-name" required></div>
            <div class="field"><label for="firstName">Prénom</label><input id="firstName" name="firstName" autocomplete="given-name" required></div>
          </div>
          <div class="field"><label for="birthDate">Date de naissance</label><input id="birthDate" name="birthDate" type="date" max="${t}" autocomplete="bday" required></div>
          <div class="field"><label for="phone">Téléphone</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="06 39 …" required></div>
          <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" autocapitalize="none" required></div>
          <legend style="margin-top:6px">🆘 Contact d'urgence</legend>
          <div class="form-grid two">
            <div class="field"><label for="emergencyName">Nom du contact</label><input id="emergencyName" name="emergencyName" required></div>
            <div class="field"><label for="emergencyPhone">Téléphone du contact</label><input id="emergencyPhone" name="emergencyPhone" type="tel" required></div>
          </div>
        </fieldset>

        <fieldset data-step="1" class="form hidden">
          <legend>⛵ Niveau de navigation</legend>
          <div class="field">
            <label for="levelId">Votre niveau</label>
            <select id="levelId" name="levelId" required>
              <option value="">Choisissez votre niveau…</option>
              ${levels.map((l) => html`<option value="${l.id}">${l.name}</option>`)}
            </select>
            <div class="chips" aria-hidden="true">${levels.map((l) => levelBadge(l))}</div>
          </div>
          <div class="banner info" style="margin:0"><span class="ico">🪪</span><div><strong>Votre licence</strong>Elle est enregistrée par Eric : transmettez-lui votre licence après l'inscription. Vous pourrez réserver dès qu'elle sera saisie.</div></div>
        </fieldset>

        <fieldset data-step="2" class="form hidden">
          <legend>🔒 Votre compte</legend>
          <div class="field"><label for="password">Mot de passe</label>
            <input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
            <span class="hint">8 caractères minimum.</span></div>
          <div class="field"><label for="password2">Confirmez le mot de passe</label>
            <input id="password2" name="password2" type="password" autocomplete="new-password" required></div>
          <label class="check"><input type="checkbox" name="acceptRules" id="acceptRules">
            <span>J'ai lu et j'accepte le <a href="#" id="show-rules">règlement du club</a>.</span></label>
        </fieldset>

        <div class="btn-row">
          <button type="button" class="btn secondary hidden" id="prev">Retour</button>
          <button type="submit" class="btn lg" id="next">Continuer</button>
        </div>
        <p class="center small">Déjà inscrit(e) ? <a href="#/connexion">Se connecter</a></p>
      </form>
    </div>`);

  const f = $('#f', root);
  let step = 0;
  const show = () => {
    $$('[data-step]', f).forEach((fs) => fs.classList.toggle('hidden', Number(fs.dataset.step) !== step));
    $$('.steps span', f).forEach((s) => s.classList.toggle('on', Number(s.dataset.s) <= step));
    $('#prev', f).classList.toggle('hidden', step === 0);
    $('#next', f).textContent = step === 2 ? 'Valider mon inscription' : 'Continuer';
    f.querySelector('.error-msg')?.remove();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const validStep = () => {
    const fs = $(`[data-step="${step}"]`, f);
    for (const el of $$('input, select', fs)) {
      if (el.type === 'checkbox') continue;
      if (!el.checkValidity() || (el.required && !el.value.trim())) {
        el.focus();
        const label = fs.querySelector(`label[for="${el.id}"]`)?.textContent || 'Ce champ';
        showError(f, new Error(el.type === 'email' && el.value ? 'Adresse email invalide.' : `« ${label} » est à compléter.`));
        return false;
      }
    }
    return true;
  };
  $('#prev', f).addEventListener('click', () => { step--; show(); });
  $('#show-rules', f).addEventListener('click', (e) => { e.preventDefault(); showRules(); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validStep()) return;
    if (step < 2) { step++; show(); return; }
    const data = formData(f);
    if (data.password !== data.password2) return showError(f, new Error('Les deux mots de passe ne correspondent pas.'));
    if (!data.acceptRules) return showError(f, new Error('Vous devez accepter le règlement du club pour vous inscrire.'));
    busy($('#next', f), async () => {
      try {
        const { user } = await api('/auth/register', { method: 'POST', body: data });
        toast(`Bienvenue à bord, ${user.firstName} ! ⛵`, 'ok');
        afterLogin(user);
      } catch (err) {
        if (err.data?.code === 'claimable') {
          if (await modal({ title: 'Vous êtes déjà membre !', icon: '⛵', body: err.message, actions: [{ label: 'Fermer', value: false, cls: 'secondary' }, { label: 'Activer mon compte', value: true }] })) location.hash = '#/premiere-connexion';
        } else showError(f, err);
      }
    });
  });
}

export function showRules() {
  return modal({
    title: 'Règlement du club', icon: '📜', left: true,
    body: html`<div class="rules">${state.config.rules}</div>`,
    actions: [{ label: 'J\'ai compris', value: true }],
  });
}

export async function rules(root) {
  mount(root, html`<div class="auth-wrap"><div class="card"><h1>Règlement du club</h1><div class="rules" style="white-space:pre-wrap">${state.config.rules}</div></div>
    <a class="btn secondary block" href="#/">Retour</a></div>`);
}

export async function forgot(root) {
  mount(root, html`
    <div class="auth-wrap">
      ${hero('Mot de passe oublié')}
      <form class="card form" id="f" novalidate>
        <p>Indiquez votre email : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
        <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
        <button class="btn lg block" type="submit">Envoyer le lien</button>
        <a class="center small" href="#/connexion">Retour à la connexion</a>
      </form>
    </div>`);
  const f = $('#f', root);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        await api('/auth/forgot', { method: 'POST', body: formData(f) });
        mount(f, html`<div class="center"><p style="font-size:2.4rem;margin:0">📬</p><h2>Vérifiez votre boîte mail</h2>
          <p class="muted">Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé (valable 1 heure).</p>
          <a class="btn block" href="#/connexion">Retour à la connexion</a></div>`);
      } catch (err) { showError(f, err); }
    });
  });
}

export async function reset(root, token) {
  mount(root, html`
    <div class="auth-wrap">
      ${hero('Nouveau mot de passe')}
      <form class="card form" id="f" novalidate>
        <div class="field"><label for="password">Nouveau mot de passe</label><input id="password" name="password" type="password" minlength="8" autocomplete="new-password" required>
          <span class="hint">8 caractères minimum.</span></div>
        <div class="field"><label for="password2">Confirmez</label><input id="password2" name="password2" type="password" autocomplete="new-password" required></div>
        <button class="btn lg block" type="submit">Enregistrer</button>
      </form>
    </div>`);
  const f = $('#f', root);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = formData(f);
    if (d.password !== d.password2) return showError(f, new Error('Les deux mots de passe ne correspondent pas.'));
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        await api('/auth/reset', { method: 'POST', body: { token, password: d.password } });
        toast('Mot de passe modifié. Connectez-vous.', 'ok');
        state.user = null;
        location.hash = '#/connexion';
      } catch (err) { showError(f, err); }
    });
  });
}

/** Page ouverte depuis les boutons de l'email de rappel */
export async function emailAction(root, token) {
  let info;
  try {
    info = await api('/email-action/info', { method: 'POST', body: { token } });
  } catch (err) {
    mount(root, html`<div class="auth-wrap">${hero('')}<div class="card center"><p>${err.message}</p>
      <a class="btn block" href="#/reservations">Ouvrir mes réservations</a></div></div>`);
    return;
  }
  const s = info.slot;
  const details = html`
    <div class="card" style="border-left:6px solid ${s.level?.color || '#22b8cf'}">
      <h2>${fmtDay(s.date)}</h2>
      <dl class="kv">
        <dt>Horaire</dt><dd>${fmtH(s.start)} – ${fmtH(s.end)}</dd>
        <dt>Niveau</dt><dd>${levelBadge(s.level)}</dd>
        <dt>Lieu</dt><dd>${s.location || state.config.defaultLocation}</dd>
      </dl>
    </div>`;
  const done = (emoji, title, text) => mount(root, html`<div class="auth-wrap">${hero('')}${details}
    <div class="card center"><p style="font-size:2.4rem;margin:0">${emoji}</p><h2>${title}</h2><p class="muted">${text}</p>
    <a class="btn block" href="${state.user ? '#/reservations' : '#/connexion'}">Ouvrir l'application</a></div></div>`);

  if (info.status !== 'booked') return done('ℹ️', 'Réservation déjà annulée', 'Cette réservation n\'est plus active.');
  if (s.past) return done('⛵', 'Séance commencée', 'Cette séance a déjà commencé.');

  if (info.action === 'confirm') {
    if (info.presenceConfirmed) return done('✅', 'Présence déjà confirmée', 'Merci, à très bientôt sur l\'eau !');
    mount(root, html`<div class="auth-wrap">${hero('Rappel de votre séance')}${details}
      <div class="card"><p class="center">C'est la dernière limite pour annuler sans risque de perdre votre créneau.</p>
      <button class="btn lg block" id="go">Je confirme ma présence</button></div></div>`);
    $('#go', root).addEventListener('click', (e) => busy(e.currentTarget, async () => {
      try { await api('/email-action', { method: 'POST', body: { token } }); done('✅', 'Présence confirmée', 'Merci ! À très bientôt sur l\'eau.'); } catch (err) { toast(err.message, 'bad'); }
    }));
    return;
  }

  mount(root, html`<div class="auth-wrap">${hero('Annuler ma réservation')}${details}
    <div class="card"><p class="center">C'est la dernière limite pour annuler sans risque de perdre votre créneau.</p>
    <div class="btn-row"><a class="btn secondary" href="${state.user ? '#/reservations' : '#/connexion'}">Garder ma réservation</a>
    <button class="btn danger" id="go">Annuler ma réservation</button></div></div></div>`);
  $('#go', root).addEventListener('click', async () => {
    const ok = await cancelFlow(s.startsAt, (force) => api('/email-action', { method: 'POST', body: { token, force } }));
    if (ok) done('🌊', 'Réservation annulée', 'Votre place a été libérée pour un autre membre.');
  });
}

/** Première connexion : membre importé (nom + prénom + téléphone) ou code d'accès donné par Eric */
export async function firstLogin(root) {
  let mode = 'name';
  const draw = () => {
    mount(root, html`
      <div class="auth-wrap">
        ${hero('Première connexion')}
        <form class="card form" id="find" novalidate>
          <div class="segmented" role="group" aria-label="Comment activer">
            <button type="button" data-m="name" aria-pressed="${mode === 'name'}">Je suis membre</button>
            <button type="button" data-m="code" aria-pressed="${mode === 'code'}">J'ai un code</button>
          </div>
          ${mode === 'name' ? html`
            <p class="muted" style="margin:0">Indiquez votre nom, votre prénom et le téléphone donnés au club, tels qu'ils figurent sur la liste des membres.</p>
            <div class="form-grid two">
              <div class="field"><label for="lastName">Nom</label><input id="lastName" name="lastName" autocomplete="family-name" required></div>
              <div class="field"><label for="firstName">Prénom</label><input id="firstName" name="firstName" autocomplete="given-name" required></div>
            </div>
            <div class="field"><label for="phone">Téléphone</label><input id="phone" name="phone" type="tel" autocomplete="tel" required>
              <span class="hint">Pour un enfant, c'est souvent le téléphone d'un parent.</span></div>`
    : html`
            <p class="muted" style="margin:0">Eric vous a donné un code d'accès (par exemple après un mot de passe perdu).</p>
            <div class="field"><label for="code">Code d'accès</label><input id="code" name="code" autocapitalize="characters" autocomplete="one-time-code" placeholder="ABCD-EFGH" style="text-transform:uppercase;letter-spacing:.1em" required></div>`}
          <button class="btn lg block" type="submit">Continuer</button>
          <a class="center small" href="#/connexion">Retour à la connexion</a>
        </form>
      </div>`);
    $$('[data-m]', root).forEach((b) => b.addEventListener('click', () => { mode = b.dataset.m; draw(); }));
    const f = $('#find', root);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      busy(f.querySelector('[type=submit]'), async () => {
        try { step2(await api('/auth/claim', { method: 'POST', body: formData(f) })); } catch (err) { showError(f, err); }
      });
    });
  };
  const step2 = (c) => {
    mount(root, html`
      <div class="auth-wrap">
        ${hero(`Bonjour ${c.firstName} ! 👋`)}
        <form class="card form" id="act" novalidate>
          <div class="banner info" style="margin:0"><span class="ico">🪪</span><div><strong>Votre identifiant : ${c.login}</strong>
            Vous pourrez vous connecter avec cet identifiant ou avec votre email. Un même email peut servir à plusieurs membres d'une famille.</div></div>
          <div class="field"><label for="email">Votre email</label><input id="email" name="email" type="email" autocomplete="email" value="${c.email}" required>
            <span class="hint">Pour recevoir les confirmations, les rappels 24 h avant les séances et les nouvelles du club.</span></div>
          <div class="field"><label for="password">Choisissez un mot de passe</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="8" required>
            <span class="hint">8 caractères minimum.</span></div>
          <div class="field"><label for="password2">Confirmez le mot de passe</label><input id="password2" name="password2" type="password" autocomplete="new-password" required></div>
          ${c.needsRules ? html`<label class="check"><input type="checkbox" name="acceptRules"><span>J'ai lu et j'accepte le <a href="#" id="show-rules">règlement du club</a>.</span></label>` : ''}
          <button class="btn lg block" type="submit">Activer mon compte</button>
        </form>
      </div>`);
    $('#show-rules', root)?.addEventListener('click', (e) => { e.preventDefault(); showRules(); });
    const f = $('#act', root);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = formData(f);
      if (d.password !== d.password2) return showError(f, new Error('Les deux mots de passe ne correspondent pas.'));
      if (c.needsRules && !d.acceptRules) return showError(f, new Error('Vous devez accepter le règlement du club.'));
      busy(f.querySelector('[type=submit]'), async () => {
        try {
          const { user } = await api('/auth/activate', { method: 'POST', body: { ...d, token: c.token } });
          toast(`Bienvenue ${user.firstName} ! Votre compte est activé ⛵`, 'ok');
          state.user = user;
          refreshUnread();
          location.hash = user.profileComplete ? '#/calendrier' : '#/profil';
        } catch (err) { showError(f, err); }
      });
    });
  };
  draw();
}
