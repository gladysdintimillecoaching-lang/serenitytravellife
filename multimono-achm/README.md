# ⛵ Multimono ACHM

Application web (mobile en priorité) de réservation des sessions de multimono du club de voile ACHM.
Langue : français · Fuseau horaire : **Indian/Mayotte (UTC+3)**.

## Fonctionnalités

**Participant**
- Carte d'inscription : identité, date de naissance, téléphone, email, contact d'urgence, licence (n°, obtention, expiration), niveau, acceptation du règlement.
- Calendrier vue **semaine** et vue **jour** : horaire, niveau requis (badge couleur), places totales et restantes, **nombre d'inscrits et leurs prénoms visibles par tous** (jamais les noms de famille ni les coordonnées).
- **Inscrire un ami du club** : un membre peut réserver une place pour un autre membre (recherche par prénom, licence de l'ami vérifiée). L'ami est prévenu par notification et email ; celui qui l'a inscrit peut annuler (l'ami est prévenu).
- Réservation en un clic, avec confirmation à l'écran et par email. Créneau complet : « Complet », bouton grisé.
- « Mes réservations » : séances à venir, bouton « Je confirme ma présence », bouton « Annuler ».
- Annulation : pop-up d'avertissement « Toute annulation doit être faite au minimum 24 h avant la séance. » puis, à moins de 24 h, pop-up rouge « Annulation tardive : vous risquez de perdre ce créneau. » (« Confirmer quand même » / « Garder ma réservation »). Les annulations tardives sont signalées au gérant.
- Licence : bandeau et notification 30 jours puis 7 jours avant l'expiration, bouton « Renouveler ma licence ». Licence expirée (à la date de la séance) = réservation bloquée avec message explicatif.
- Notifications dans l'app (cloche avec compteur) + emails.

**Gérant (Eric)**
- Connexion par identifiant (`eric` par défaut).
- Tableau de bord : séances du jour et de la semaine, taux de remplissage, licences arrivant à expiration, annulations tardives.
- Séances : création unique ou **récurrente** (jours de pratique, période), modification, suppression (une séance ou toute la suite d'une série). Les inscrits sont notifiés automatiquement (app + email).
- **Activités de l'école de voile** : chaque séance appartient à une activité (nom + couleur, gérées par Eric dans « Plus › Activités de l'école »), avec un groupe optionnel (ex. « 1 · Débutant »). Les membres filtrent le calendrier par activité ; l'activité figure dans les emails et le rappel.
- **Planning habituel de l'école** (13 séances par semaine, 6 places chacune, modifiable dans Réglages, créé en un clic sur une période, sans doublon) :

  | Jour | Horaire | Activité |
  |---|---|---|
  | Mercredi | 14h00 – 16h30 | École de sport |
  | Jeudi | 9h00 – 12h00 | Multimono en semaine |
  | Vendredi | 8h30 – 11h30 | Laser en semaine |
  | Vendredi | 14h00 – 16h30 | Opti Loisir |
  | Samedi | 9h00 – 11h30 · 12h00 – 14h30 · 15h00 – 17h30 | Multimono week-end |
  | Samedi | 9h30 – 12h00 | Planche à voile (PAV) |
  | Samedi | 14h00 – 17h00 | Laser week-end |
  | Dimanche | 9h00 – 11h30 (1 · Débutant) · 12h00 – 14h30 (2 · Junior) · 15h00 – 17h30 (3 · Confirmé) | Planche à voile (PAV) |
  | Dimanche | 14h00 – 17h00 | Laser week-end |
- Liste des inscrits par séance, **numérotée 1 à 6 comme la feuille** (places libres visibles), avec badge niveau, statut de licence, présence confirmée, téléphone et contact d'urgence.
- Inscriptions par le gérant : **inscrire un membre** (téléphone, en direct), **réserver des places pour un invité ou un groupe** sans compte (ex. un groupe de 5), **retirer un participant** (prévenu, sans pénalité).
- Membres : filtres (niveau, licence valide / bientôt expirée / expirée), recherche, **export CSV** (compatible Excel).
- Historique des annulations tardives.
- **Cartes activité (5 séances + 1 offerte)** : Eric crée une carte pour un membre (pour une activité ou « toutes activités », modifiable à tout moment), puis valide chaque séance utilisée — depuis la fiche d'une séance (date et activité reprises automatiquement, jamais deux fois) ou à la main avec une date. Chaque case affiche la date utilisée ; une validation peut être annulée. Le membre voit sa carte (dates et séances restantes) dans son profil, Eric dans la fiche membre, la liste des membres et la fiche séance. À la **5ème séance**, le membre reçoit un email : « Vous venez d'utiliser votre 5ème séance, pas de panique ! Il vous en reste une offerte » (une seule fois par carte) ; à la 6ème, une notification « carte terminée ».
- **Récompenses** : 8 couleurs de progression — Blanc, Jaune, Jaune-orange, Orange, Orange-vert, Vert, Bleu, Violet (les couleurs doubles s'affichent moitié-moitié). Chaque membre commence en Blanc ; Eric change la couleur à la main dans la fiche du membre, avec un mot personnel optionnel. Si le membre progresse, il reçoit une notification et un email de félicitations avec son prochain objectif (message spécial au Violet). Une correction vers une couleur inférieure n'envoie rien. Historique, filtre et colonne CSV inclus ; le membre voit sa couleur et sa frise de progression dans son profil.
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
| **Joyeux anniversaire** à 00:00 (heure de Mayotte) le jour J, une fois par an (né un 29 février : le 28 les années non bissextiles) | ✅ | ✅ |

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
