# ⛵ Multimono ACHM

Application web (mobile en priorité) de réservation des sessions de multimono du club de voile ACHM.
Langue : français · Fuseau horaire : **Indian/Mayotte (UTC+3)**.

## Fonctionnalités

**Participant**
- Carte d'inscription : identité, date de naissance, téléphone, email, contact d'urgence, licence (n°, obtention, expiration), niveau, acceptation du règlement.
- Calendrier vue **semaine** et vue **jour** : horaire, niveau requis (badge couleur), places totales et restantes. Les noms des inscrits ne sont jamais visibles.
- Réservation en un clic, avec confirmation à l'écran et par email. Créneau complet : « Complet », bouton grisé.
- « Mes réservations » : séances à venir, bouton « Je confirme ma présence », bouton « Annuler ».
- Annulation : pop-up d'avertissement « Toute annulation doit être faite au minimum 24 h avant la séance. » puis, à moins de 24 h, pop-up rouge « Annulation tardive : vous risquez de perdre ce créneau. » (« Confirmer quand même » / « Garder ma réservation »). Les annulations tardives sont signalées au gérant.
- Licence : bandeau et notification 30 jours puis 7 jours avant l'expiration, bouton « Renouveler ma licence ». Licence expirée (à la date de la séance) = réservation bloquée avec message explicatif.
- Notifications dans l'app (cloche avec compteur) + emails.

**Gérant (Eric)**
- Connexion par identifiant (`eric` par défaut).
- Tableau de bord : séances du jour et de la semaine, taux de remplissage, licences arrivant à expiration, annulations tardives.
- Séances : création unique ou **récurrente** (jours de pratique, période), modification, suppression (une séance ou toute la suite d'une série). Les inscrits sont notifiés automatiquement (app + email).
- **Planning habituel** (repris de la feuille « Inscription Multimono ») : samedi 12h00–14h30 et 15h00–17h30, dimanche 14h00–16h30, 6 places. Créé en un clic sur une période, modifiable dans Réglages, sans doublon.
- Liste des inscrits par séance, **numérotée 1 à 6 comme la feuille** (places libres visibles), avec badge niveau, statut de licence, présence confirmée, téléphone et contact d'urgence.
- Inscriptions par le gérant : **inscrire un membre** (téléphone, en direct), **réserver des places pour un invité ou un groupe** sans compte (ex. un groupe de 5), **retirer un participant** (prévenu, sans pénalité).
- Membres : filtres (niveau, licence valide / bientôt expirée / expirée), recherche, **export CSV** (compatible Excel).
- Historique des annulations tardives.
- Niveaux : création, renommage, suppression, ordre, **couleur au choix**.
- Réglages : nom, lieu par défaut, règlement, lien de renouvellement de licence, option « bloquer les réservations sous le niveau requis ».

**Notifications automatiques**
| Événement | App | Email |
|---|---|---|
| Confirmation de réservation | ✅ | ✅ |
| Rappel **exactement 24 h avant** la séance (date, horaire, niveau, lieu + boutons « Je confirme ma présence » / « Annuler ma réservation » + « C'est la dernière limite pour annuler sans risque de perdre votre créneau. ») | ✅ | ✅ |
| Modification / suppression d'un créneau par le gérant | ✅ | ✅ |
| Licence : 30 jours puis 7 jours avant expiration | ✅ | ✅ |
| Annulation tardive (au gérant) | ✅ | ✅ |

> Le rappel part à H-24 : une annulation faite depuis ce rappel dans l'heure qui suit (`REMINDER_GRACE_MINUTES`) est considérée « à temps », sinon le bouton du rappel serait toujours tardif. Une réservation faite moins de 24 h avant la séance ne reçoit pas de rappel (la confirmation en tient lieu).

## Démarrage rapide

Prérequis : Node.js 20 ou plus.

```bash
npm install
cp .env.example .env      # puis complétez
npm start                 # http://localhost:3000
```

Au premier démarrage, le compte gérant est créé (identifiant `ADMIN_LOGIN`, mot de passe `ADMIN_PASSWORD`, ou un mot de passe provisoire affiché dans la console).
Sans SMTP configuré, les emails sont affichés dans la console au lieu d'être envoyés.

Données de démonstration (sur une base de test uniquement) : `node scripts/seed-demo.js` (membres `ali@demo.fr`, `julien@demo.fr`… mot de passe `demo1234`).

Tests automatisés : `npm test`.

## Mise en ligne

L'application est un seul service Node.js avec une base SQLite (fichier `data/multimono.db`). Il faut un hébergement **toujours actif** (pas de mise en veille), sinon les rappels H-24 ne partent pas à l'heure.

**Docker (VPS, NAS, Fly.io, Railway…)**
```bash
docker build -t multimono-achm .
docker run -d --name multimono -p 3000:3000 --env-file .env -v multimono-data:/app/data --restart unless-stopped multimono-achm
```

Points importants :
- Servir en **HTTPS** (Caddy, Nginx ou l'hébergeur) et renseigner `APP_URL` avec l'adresse publique.
- Définir `APP_SECRET`, `ADMIN_PASSWORD` et le SMTP (Brevo, Mailjet, OVH… quelques centaines d'emails/jour sont gratuits).
- **Sauvegarder** le volume `data/` (ex. copie quotidienne de `multimono.db`).
- L'app est installable sur le téléphone (« Ajouter à l'écran d'accueil »).

## Architecture

```
server/
  index.js      serveur Express, en-têtes de sécurité, fichiers statiques
  api.js        routes REST (participant + /api/admin)
  bookings.js   réservation (transaction anti-surréservation), annulation (24 h), présence
  scheduler.js  tâches chaque minute : rappels H-24, alertes licence, envoi des emails
  notify.js     notifications app + gabarits d'emails
  mailer.js     file d'attente d'emails avec réessais (table outbox)
  auth.js       mots de passe (scrypt), sessions (cookie HttpOnly), liens signés
  db.js         schéma SQLite (WAL)
  time.js       dates au fuseau de Mayotte
public/         application web (HTML/CSS/JS sans étape de build), PWA + service worker
test/           tests automatisés (node:test)
```

Sécurité : mots de passe hachés (scrypt), cookies HttpOnly/SameSite, CSP stricte, limitation des tentatives de connexion, liens d'email signés (HMAC) et expirants, protection contre l'injection de formules dans l'export CSV, contrôles d'accès côté serveur.
