# École de voile ACHM — Kit d'installation sur Hercules

Hercules construit l'application en discutant avec son IA (frontend, base de données, connexion, emails, tâches planifiées et hébergement inclus).
Ce kit contient **6 messages à copier-coller dans le chat Hercules, dans l'ordre**. Ils décrivent exactement l'application déjà construite et testée (dossier `multimono-achm/`, 21 tests automatiques), qui sert de référence.

## À avoir sous la main

| Élément | Où le trouver | Quand |
|---|---|---|
| Logo Serenity Life (lotus, fond transparent) | `multimono-achm/public/icons/serenity-lotus.png` | à joindre au **Message 6** |
| Icône de l'application (voilier) | `multimono-achm/public/icons/icon.svg` | à joindre au **Message 1** |
| Liste des membres du club (218 membres) | fichier `membres-ACHM-import.tsv` (envoyé à part, **hors du dépôt** car il contient des données personnelles) | à importer par Eric **une fois l'app en ligne** |
| Mot de passe initial d'Eric | à choisir vous-même | secret `ADMIN_PASSWORD` du projet Hercules |

## Mode d'emploi

1. Créez un nouveau projet Hercules nommé **École de voile ACHM**.
2. Collez le **Message 1** (avec l'icône jointe), attendez que Hercules ait fini, vérifiez dans l'aperçu avec la checklist « À vérifier ».
3. Passez au message suivant. **Un message à la fois** : l'IA travaille mieux par étapes.
4. Si quelque chose ne correspond pas, répondez à Hercules : « Ce n'est pas conforme : … » en citant la règle du message concerné.
5. À la fin, suivez « Avant de publier », puis cliquez sur **Publier**.

---

## Message 1 — Fondations, design, inscription, profil, niveaux, réglages

```
Crée une application web responsive, mobile en priorité, appelée « École de voile ACHM », pour l'école de voile ACHM à Mayotte (Multimono, Laser, Opti Loisir, Planche à voile, École de sport). Toute l'interface est en français. Fuseau horaire unique : Indian/Mayotte (UTC+3, pas d'heure d'été) — toutes les dates et heures affichées et saisies sont à l'heure de Mayotte. L'icône de l'application (voilier) est jointe.

DESIGN
- Thème inspiré de la mer. Couleurs : bleu abysse #0B3954 (titres, barre du haut), bleu océan #0E7490 (boutons principaux), turquoise #22B8CF (accents), lagon #5EEAD4, blanc écume #F7FCFD et fond #EAF6F8, sable #F6E7C8 (cartes secondaires), corail #F97352 (badges d'alerte), rouge #DC2626 (danger).
- Barre du haut avec un dégradé abysse → océan → turquoise et une petite vague blanche en bas ; à gauche l'icône + le nom de l'application, en dessous « Club de voile » (ou « Espace gérant » pour Eric) ; à droite une cloche de notifications.
- Gros boutons arrondis (hauteur minimale 52 px), cartes blanches aux coins arrondis, navigation par onglets en bas de l'écran sur mobile (en haut sur ordinateur).
- Polices : Rubik pour les titres, Nunito Sans pour le texte.
- Application installable sur l'écran d'accueil (PWA, nom court « Voile ACHM »).

RÔLES
1. Membre (participant) : onglets Calendrier, Réservations, Notifications, Profil.
2. Gérant (Eric) : onglets Tableau, Séances, Membres, Plus. Il se connecte avec l'identifiant « eric ». Un seul compte gérant, créé à l'installation. Son mot de passe initial NE doit PAS être écrit dans le code ni deviné : lis-le depuis un secret de configuration du projet nommé ADMIN_PASSWORD (que je définirai moi-même) ; dis-moi où le définir.

IDENTIFIANT ET CONNEXION
- Chaque membre reçoit un IDENTIFIANT personnel « prenom.nom » (minuscules, sans accents ni espaces ; unique, suffixe 2, 3… si besoin).
- Connexion avec l'identifiant OU l'email + mot de passe. Un même email peut être partagé par plusieurs membres d'une famille (l'email n'est PAS unique) : si plusieurs comptes de cet email ont ce mot de passe, afficher « Qui se connecte ? » avec leurs prénoms.
- « Mot de passe oublié ? » : email avec un lien valable 1 heure ; si l'email est partagé, un lien par membre de la famille.
- Page de connexion : champ « Email ou identifiant » (exemple « prenom.nom ou votre email »), mot de passe, bouton « Se connecter », lien « Mot de passe oublié ? », puis une carte « Déjà membre du club ? » avec le bouton « Première connexion / code d'accès » (page décrite au message 6), puis une carte sable « Nouveau au club ? » avec « Créer ma carte d'inscription ». Sous le logo : « Réservez vos séances de voile en un clic 🌊 ».

CARTE D'INSCRIPTION (formulaire en 3 étapes avec barre de progression)
- Étape 1 « Vos coordonnées » : nom, prénom, date de naissance, téléphone, email ; contact d'urgence (nom + téléphone).
- Étape 2 « Niveau » : niveau de navigation choisi dans la liste définie par Eric (niveaux affichés avec leur couleur). Encadré : « Votre licence est enregistrée par Eric : transmettez-lui votre licence après l'inscription. Vous pourrez réserver dès qu'elle sera saisie. »
- Étape 3 « Votre compte » : mot de passe (8 caractères minimum) + confirmation, case obligatoire « J'ai lu et j'accepte le règlement du club » avec un lien qui ouvre le règlement dans une fenêtre. Enregistrer la date d'acceptation.
- LA LICENCE (numéro, date d'obtention, date d'expiration) EST SAISIE UNIQUEMENT PAR ERIC (message 4). Le membre ne la saisit jamais.
- Après l'inscription : notification de bienvenue indiquant l'identifiant.

PROFIL DU MEMBRE (onglet « Profil »)
- En-tête : initiales, prénom NOM, « Identifiant : prenom.nom », badge de niveau, badge de statut de licence (vert « Licence valide », orange « Expire dans N j », rouge « Licence expirée » / « Pas de licence »).
- Bandeau « Complétez votre carte d'inscription » si date de naissance, téléphone ou contact d'urgence manquent.
- Formulaire : nom, prénom, date de naissance, téléphone, email, contact d'urgence, niveau. La LICENCE est affichée en LECTURE SEULE (numéro, obtenue le, expire le) avec la phrase « Votre licence est enregistrée par Eric. Après un renouvellement, transmettez-lui votre nouvelle licence. »
- Changement de mot de passe, bouton « Lire le règlement », bouton « Se déconnecter ».

NIVEAUX DE NAVIGATION
- Table des niveaux : nom, couleur (hex), ordre. Niveaux de départ : Découverte #38BDF8, Initié #14B8A6, Confirmé #F59E0B, Expert #EF4444.
- Eric crée, renomme, réordonne (▲▼), supprime les niveaux et choisit la couleur avec un sélecteur. Avant de supprimer : afficher combien de membres et de séances à venir l'utilisent ; ils passent en « non renseigné » / « Tous niveaux ».
- La couleur du niveau apparaît en badge (pastille arrondie, texte blanc) sur le profil et dans les listes d'Eric. Un membre sans niveau n'a pas de badge.

RÉGLAGES (page « Plus › Réglages », Eric seulement)
- Nom de l'application : « École de voile ACHM » (modifiable).
- Lieu par défaut des séances : « Club de voile ACHM ».
- Lien « Renouveler ma licence » : https://www.ffvoile.fr/ffv/web/licence/
- Option « Bloquer les réservations sous le niveau requis » (désactivée par défaut).
- Option « Carte activité obligatoire pour réserver » (ACTIVÉE par défaut, règle au message 5).
- Planning habituel (message 2).
- Règlement du club, texte par défaut :
  « Règlement intérieur du club — École de voile ACHM
  1. Le port du gilet de sauvetage est obligatoire sur l'eau.
  2. Une licence en cours de validité est obligatoire pour participer aux séances.
  3. Toute annulation doit être faite au minimum 24 h avant la séance.
  4. Les consignes de sécurité du moniteur doivent être respectées à tout moment.
  5. Le matériel du club est utilisé avec soin et rincé après chaque séance. »
- Compte gérant : prénom, email (reçoit les alertes), téléphone, mot de passe.
```

**À vérifier :** inscription en 3 étapes sans licence, identifiant affiché dans le profil, licence en lecture seule, connexion d'Eric avec « eric », page Niveaux avec sélecteur de couleur, page Réglages.

---

## Message 2 — Activités, séances, calendrier, réservation

```
Ajoute les activités, les séances et la réservation.

ACTIVITÉS DE L'ÉCOLE DE VOILE
- Table « activités » : nom, couleur, nombre de places par défaut, ordre. Eric les gère dans « Plus › Activités de l'école » (créer, renommer, couleur au sélecteur, places par séance, ordre ▲▼, supprimer : les séances concernées passent en « activité non précisée »).
- Activités de départ (couleur, places par séance) :
  École de sport #0EA5E9 (6) · Multimono en semaine #0E7490 (6) · Laser en semaine #E11D48 (4) · Opti Loisir #F59E0B (12) · Multimono week-end #14B8A6 (6) · Planche à voile (PAV) #8B5CF6 (4) · Laser week-end #DC2626 (4)

SÉANCES
- Une séance a : activité, groupe optionnel (texte court, ex. « 1 · Débutant »), date, heure de début, heure de fin, nombre de places, niveau requis (ou « Tous niveaux »), lieu (vide = lieu par défaut), remarque optionnelle, et éventuellement une série (récurrence).
- PLANNING HABITUEL DE L'ÉCOLE, modifiable dans Réglages (lignes activité / groupe / jour / début / fin / places ; choisir l'activité d'une ligne propose ses places par défaut) :
  • Mercredi 14h00 – 16h30 : École de sport (6)
  • Jeudi 9h00 – 12h00 : Multimono en semaine (6)
  • Vendredi 8h30 – 11h30 : Laser en semaine (4)
  • Vendredi 14h00 – 16h30 : Opti Loisir (12)
  • Samedi 9h00 – 11h30, 12h00 – 14h30 et 15h00 – 17h30 : Multimono week-end (6)
  • Samedi 9h30 – 12h00 : Planche à voile (PAV) (4)
  • Samedi 14h00 – 17h00 : Laser week-end (4)
  • Dimanche 9h00 – 11h30 : Planche à voile (PAV), groupe « 1 · Débutant » (4)
  • Dimanche 12h00 – 14h30 : Planche à voile (PAV), groupe « 2 · Junior » (4)
  • Dimanche 15h00 – 17h30 : Planche à voile (PAV), groupe « 3 · Confirmé » (4)
  • Dimanche 14h00 – 17h00 : Laser week-end (4)
- Page « Nouvelle séance » (Eric) avec 3 modes :
  1. « Unique » : une date.
  2. « Récurrente » : jours de pratique (puces Lun…Dim), du … au …, afficher « N séances seront créées ».
  3. « Planning habituel » : afficher la liste du planning, puis du … au … ; crée toutes ces séances sur la période (JAMAIS dans le passé), sans doublon si une séance de la même activité existe déjà au même horaire. Afficher « N séances créées (M déjà existantes) ».
  Champs communs : activité (choisir une activité propose ses places par défaut), groupe, début, fin (après le début), places, niveau requis, lieu, remarque. Maximum 400 séances par création.

CALENDRIER (onglet « Calendrier » des membres, et onglet « Séances » d'Eric)
- Boutons « Semaine » / « Jour », semaine précédente / suivante, « Revenir à aujourd'hui », mention « Heure de Mayotte ».
- Rangée de filtres défilante : « Toutes » + une pastille par activité (bordure de la couleur de l'activité, remplie quand choisie) ; choix mémorisé sur l'appareil.
- Vue semaine : séances groupées par jour (sur mobile, seulement les jours qui ont des séances, plus aujourd'hui ; sur ordinateur, grille de 7 colonnes). Vue jour : bandeau des 7 jours (point sous les jours avec séances), puis les séances du jour choisi.
- Carte de séance : liseré gauche de la COULEUR DE L'ACTIVITÉ ; au-dessus de l'horaire, le nom de l'activité en couleur (+ le groupe en pastille) ; horaire en gros (« 12h00 – 14h30 ») ; badge du niveau requis ; lieu ; remarque ; barre de remplissage ; « N places restantes » et « pris/total ».
- Sous chaque séance, visible par TOUS les membres : « N inscrits : » + les PRÉNOMS des inscrits (pastilles, dans l'ordre d'inscription ; « Vous » en bleu pour soi-même ; invités/groupes en sable avec « ×N » s'ils prennent plusieurs places). Jamais les noms de famille ni les coordonnées (seul Eric les voit). S'il n'y a personne : « Aucun inscrit pour l'instant — soyez le premier ! »
- Bouton « Réserver ». Séance pleine : bouton grisé « Complet ». Déjà inscrit : badge vert « Inscrit(e) » + bouton « Annuler ». Séance passée : grisée, « Séance passée ».
- Rafraîchir les places toutes les 30 secondes et au retour dans l'application.

RÉSERVATION EN UN CLIC
- Un clic sur « Réserver » réserve immédiatement, puis fenêtre « Réservation confirmée ! » avec l'activité, la date et l'horaire, et « Un email de confirmation vous a été envoyé. Vous recevrez un rappel 24 h avant la séance. »
- Règles vérifiées côté serveur, de façon atomique (deux personnes ne peuvent jamais obtenir la dernière place en même temps) :
  • pas de réservation d'une séance déjà commencée ; pas de double réservation ;
  • pas de dépassement du nombre de places (places prises = réservations actives + places réservées pour des invités, message 4) ;
  • LICENCE : fenêtre « Réservation bloquée » avec un bouton « Renouveler ma licence » (lien des Réglages) et deux messages distincts :
    – aucune licence enregistrée : « Votre licence n'est pas encore enregistrée. Transmettez votre licence à Eric : il l'enregistrera et vous pourrez réserver. »
    – licence expirée à la DATE DE LA SÉANCE : « Votre licence ne sera plus valide à la date de cette séance. Pour des raisons d'assurance, la réservation est bloquée : renouvelez votre licence et transmettez-la à Eric, qui mettra votre profil à jour. »
  • CARTE ACTIVITÉ : règle décrite au message 5 (à ajouter à ce moment-là) ;
  • si « Bloquer sous le niveau requis » est active : le niveau du membre doit être au moins égal (ordre des niveaux) au niveau requis.
- Le compte gérant ne réserve pas pour lui-même.

INSCRIRE UN AMI DU CLUB
- Sur chaque séance non complète : bouton « Inscrire un ami du club ». Recherche parmi les membres (2 lettres minimum, résultat « Prénom N. » + badge de niveau, rien d'autre).
- Les mêmes règles s'appliquent à l'ami (places, double inscription, SA licence, et plus tard SA carte), avec des messages à son nom (« La licence de Prénom ne sera plus valide… », « Prénom n'a pas de licence enregistrée… »).
- L'ami reçoit une notification + un email « Prénom vous a inscrit(e) ». La réservation appartient à l'ami (rappel H-24, présence, annulation). Celui qui l'a inscrit la voit dans « Mes réservations › Amis que j'ai inscrits » et peut l'annuler (même parcours d'annulation et règle des 24 h) ; l'ami est alors prévenu.

MES RÉSERVATIONS (onglet « Réservations »)
- Séances à venir : activité, date, horaire, niveau, lieu, places.
- Moins de 24 h avant : bandeau orange « Séance dans moins de 24 h : une annulation serait tardive. »
- Bouton « Je confirme ma présence » (à partir de 25 h avant, tant que ce n'est pas confirmé) ; ensuite badge « Présence confirmée ».
- Bouton « Annuler » sur chaque réservation (message 3). Section « Amis que j'ai inscrits ».
```

**À vérifier :** créer le planning habituel sur 2 mois (13 séances par semaine, PAV et Laser à 4 places, Opti à 12), filtrer par activité, réserver, voir « Complet », voir les prénoms des inscrits, inscrire un ami.

---

## Message 3 — Annulation, règle des 24 h, rappels, notifications, anniversaires

```
Ajoute l'annulation, les notifications et les tâches automatiques.

ANNULATION PAR LE MEMBRE
- À CHAQUE annulation, d'abord une fenêtre : titre « Annuler cette réservation ? », texte en gras « Toute annulation doit être faite au minimum 24 h avant la séance. », boutons « Retour » et « Annuler la séance » (rouge).
- PLUS de 24 h avant : annulation confirmée, place libérée immédiatement et visible par tous. Message « Annulation confirmée : la place est libérée. »
- MOINS de 24 h avant : seconde fenêtre ROUGE (bordure rouge, icône 🚨) : titre « Annulation tardive », texte « Annulation tardive : vous risquez de perdre ce créneau. » et « La séance commence dans moins de 24 h. Le gérant sera informé de cette annulation. », boutons « Confirmer quand même » (rouge) et « Garder ma réservation ».
  • « Garder ma réservation » : rien ne change.
  • « Confirmer quand même » : statut « annulation tardive », place libérée, ligne ajoutée à l'HISTORIQUE DES ANNULATIONS TARDIVES (nom du membre, séance, heures avant le début, date — conservée même si la séance est supprimée ensuite), notification + email à Eric « Annulation tardive — Prénom Nom ».
- Exception : une annulation faite dans l'heure qui suit l'envoi du rappel H-24 (marge réglable, 60 minutes) n'est PAS tardive.
- Le calcul « plus/moins de 24 h » se fait côté serveur.

NOTIFICATIONS
- Cloche dans la barre du haut avec le nombre de non lues (rafraîchi chaque minute) ; page « Notifications » avec les 50 dernières, non lues surlignées en turquoise ; tout passe en « lu » à l'ouverture.
- Chaque notification importante est AUSSI envoyée par email. Gabarit : bandeau dégradé bleu avec « ⛵ École de voile ACHM » et le titre, tableau Activité / Date / Horaire / Niveau / Lieu, boutons arrondis, encadré sable pour les avertissements, pied de page « Message automatique — ouvrir l'application ».
- Types : confirmation de réservation ; inscription par un ami ; rappel H-24 ; séance modifiée par Eric (« Votre séance a été modifiée » + liste des changements) ; séance supprimée par Eric (« Séance annulée par le club », sans pénalité, bouton « Réserver un autre créneau ») ; réservation retirée par Eric ; alerte de licence ; annulation tardive (à Eric) ; bienvenue ; anniversaire ; récompense et cartes (message 5).

RAPPEL AUTOMATIQUE 24 H AVANT
- Tâche planifiée CHAQUE MINUTE : pour chaque réservation active dont la séance commence dans 24 h ou moins (pas encore commencée) et sans rappel envoyé : envoyer le rappel puis le marquer (jamais deux fois). Si Eric change l'heure de la séance, le rappel est réinitialisé. Pas de rappel pour une réservation faite moins de 24 h avant la séance.
- Contenu (notification + email) : objet « Rappel : [activité] demain à HHhMM », titre « Rappel : votre séance est dans 24 h ⛵ », activité, date, horaire, niveau, lieu, et « C'est la dernière limite pour annuler sans risque de perdre votre créneau. »
- Deux boutons : « Je confirme ma présence » et « Annuler ma réservation ». Dans l'app : ils agissent directement (l'annulation suit le parcours avec avertissements). Dans l'email : lien signé et à durée limitée vers une page de l'app qui fonctionne SANS se connecter ; la page affiche la séance puis le bouton d'action (ouvrir le lien ne modifie rien, il faut cliquer).

ALERTES DE LICENCE
- Tâche planifiée : licence qui expire dans 30 jours ou moins → « Votre licence expire bientôt » ; dans 7 jours ou moins → « Votre licence expire très bientôt ⏳ ». Une seule fois par date d'expiration (si on passe directement sous 7 jours, seulement l'alerte 7 jours). Nouvelle date d'expiration = les alertes repartent de zéro.
- Texte : « Votre licence expire le [date] (dans N jours). Pensez à la renouveler et à la transmettre à Eric pour continuer à réserver. » Email avec le bouton « Renouveler ma licence » ; « Après renouvellement, transmettez votre nouvelle licence à Eric : il mettra votre profil à jour. »
- BANDEAU dans le profil, le calendrier et « Mes réservations » :
  • 8 à 30 jours : orange « Votre licence expire dans N jours — Pensez à la renouveler pour continuer à réserver vos séances. » + bouton « Renouveler ma licence » ;
  • 0 à 7 jours : le même en rouge ;
  • absente : rouge « Aucune licence enregistrée — La réservation des séances est bloquée tant que votre licence n'est pas transmise à Eric et enregistrée. » ;
  • expirée : rouge « Votre licence est expirée — La réservation des séances est bloquée tant que votre licence n'est pas renouvelée et transmise à Eric. »
  Le bouton « Renouveler ma licence » ouvre le site de la fédération dans un nouvel onglet.

JOYEUX ANNIVERSAIRE
- Tâche planifiée : à 00:00 (heure de Mayotte) le jour de l'anniversaire (date de naissance de la carte), notification + email, UNE SEULE FOIS par an (même après un redémarrage). Né un 29 février : le 28 février les années non bissextiles.
- Objet « Joyeux anniversaire Prénom ! 🎂⛵ ». Texte : « Bonjour Prénom, Toute l'équipe du club vous souhaite un très joyeux anniversaire ! 🎉 Que cette nouvelle année vous apporte bon vent, belle mer et de magnifiques navigations avec le club. Au plaisir de vous retrouver très vite sur l'eau. Eric et l'équipe École de voile ACHM », bouton « Réserver ma prochaine séance ».

EMAILS
- Envoi via le service d'email intégré de Hercules, avec file d'attente et réessais. Expéditeur : « École de voile ACHM ».
```

**À vérifier :** annuler à plus de 24 h (place libérée), à moins de 24 h (fenêtre rouge + historique + notification à Eric), recevoir l'email de confirmation.

---

## Message 4 — Espace gérant (Eric)

```
Ajoute l'espace gérant, accessible uniquement au compte gérant (contrôle côté serveur sur toutes les actions).

TABLEAU DE BORD (onglet « Tableau »)
- « Bonjour Eric 👋 » et bouton « Nouvelle séance ».
- 4 tuiles : séances aujourd'hui ; remplissage de la semaine (anneau en %, « places prises / places offertes ») ; licences à surveiller (expirées ou sous 30 jours, chiffre en rouge s'il y en a) ; annulations tardives des 30 derniers jours.
- Séances du jour ; séances de la semaine avec activité et barre de remplissage (« 4/6 ») ; membres dont la licence expire sous 30 jours ou est expirée (bandeau rouge « N licences expirées — ces membres ne peuvent plus réserver »).

FICHE D'UNE SÉANCE (depuis l'onglet « Séances »)
- Activité, groupe, horaire, niveau, lieu, remarque, série, barre de remplissage ; boutons « Modifier » et « Supprimer ».
- Liste des inscrits NUMÉROTÉE de 1 au nombre de places (comme l'ancienne feuille « Inscription Multimono ») : d'abord les membres dans l'ordre d'inscription (pastille numérotée de la couleur de leur niveau, Prénom NOM, badge de niveau, statut de licence à la date de la séance, « ✓ Présence confirmée », contact d'urgence avec lien d'appel, bouton d'appel, bouton ✕ pour retirer), puis les invités/groupes (fond sable, badge « Invité » ou « Groupe · N places »), puis les places restantes « Place libre » en pointillés.
- « Inscrire un membre » : recherche puis inscription par Eric (téléphone, en direct) ; pas de contrôle de licence ni de carte (Eric décide), mais le nombre de places est respecté ; le membre reçoit la confirmation.
- « Invité / groupe » : nom, nombre de places (au maximum les places libres), téléphone et remarque optionnels ; uniquement sur une séance pas encore commencée (exemple réel : « Anffane », 5 places).
- Retirer un membre : place libérée, membre prévenu (« Réservation retirée par le gérant »), aucune pénalité. Retirer un invité libère ses places.
- Section « Annulations » de la séance (« À temps » ou « Tardive », date).
- MODIFIER : activité, groupe, date, début, fin, places (jamais moins que les places prises — message d'erreur), niveau, lieu, remarque. Si l'activité, le groupe, la date, l'horaire, le niveau, le lieu ou la remarque change, les inscrits reçoivent une notification + un email avec les changements. Bandeau avant l'enregistrement : « N participants inscrits — ils recevront automatiquement une notification ».
- SUPPRIMER : « Supprimer cette séance » ou, pour une série, « Supprimer celle-ci et les N suivantes ». Les inscrits des séances futures sont prévenus (rappeler à Eric de prévenir lui-même les invités sans compte).

MEMBRES (onglet « Membres »)
- Boutons « Importer » (message 6) et « Export CSV ».
- Recherche (nom, prénom, email, identifiant, téléphone, n° de licence) et filtres : niveau ; licence (toutes / valide / expire sous 30 jours / expirée ou absente) ; compte (tous / ⏳ à activer / ✓ activés) ; catégorie ; récompense (message 5).
- Chaque ligne : initiales sur la couleur du niveau, NOM Prénom, badges (niveau, récompense, licence, « ⏳ À activer », catégorie, « 🎟️ N restantes », « N annul. tardives »).
- Export CSV (respecte les filtres) : séparateur point-virgule, UTF-8 avec BOM pour Excel, colonnes : Catégorie ; Identifiant ; Compte ; Nom ; Prénom ; Date de naissance ; Téléphone ; Email ; Contact urgence ; Tél. urgence ; N° licence ; Obtention licence ; Expiration licence ; Statut licence ; Niveau ; Récompense ; Annulations tardives ; Inscrit le. Protéger contre l'injection de formules (préfixer d'une apostrophe les cellules commençant par = + - @, une tabulation ou un retour chariot).

FICHE MEMBRE
- En-tête : catégorie, niveau, récompense, licence, « ⏳ Compte à activer » ou « ✓ Compte activé ».
- Carte « 🔑 Accès au compte » (message 6).
- Formulaire « 📝 Fiche & licence » : nom, prénom, téléphone, email, catégorie, note privée (visible par Eric seul), et LA LICENCE (numéro, obtenue le, expire le — l'expiration doit être après l'obtention). Affichage en lecture seule : date de naissance, contact d'urgence, règlement accepté le, inscrit le.
- Niveau de navigation (modifiable), séances à venir, historique des annulations tardives, bouton « Supprimer ce membre » (avec confirmation).
- Cartes activité et récompense : message 5.

PLUS (onglet « Plus »)
- Liens : Notifications ; Annulations tardives (historique complet, du plus récent : membre, séance, « annulée X,X h avant », date) ; Activités de l'école ; Niveaux de navigation ; Réglages ; Se déconnecter.
```

**À vérifier :** fiche séance numérotée avec « Place libre », ajout d'un groupe de 2 places, saisie d'une licence dans la fiche membre, export CSV ouvert dans Excel.

---

## Message 5 — Cartes activité (5 + 1 offerte) et récompenses

```
Ajoute les cartes activité et les récompenses.

CARTES ACTIVITÉ (5 séances + 1 offerte = 6)
- Eric crée une carte dans la fiche membre : « Nouvelle carte (5 + 1 offerte) », pour une activité précise ou « Toutes activités ». Il peut CHANGER L'ACTIVITÉ d'une carte à tout moment (même après des séances utilisées), ou la supprimer.
- Valider une séance utilisée :
  • depuis la fiche d'une séance : sur chaque inscrit, pastille « 🎟️ N restantes » (ou « 🎟️ Pas de carte »), bouton « ✓ Valider la séance sur sa carte » qui reprend la date et l'activité de la séance ; une même séance ne peut jamais être validée deux fois pour un membre ; ensuite « 🎟️ Séance validée » ;
  • depuis la fiche membre : date (aujourd'hui par défaut) + activité optionnelle, bouton « ✓ Valider sur la carte en cours ».
- Quelle carte : la PLUS ANCIENNE carte en cours valable pour l'activité (une carte « Toutes activités » vaut pour tout ; sans activité précisée, n'importe quelle carte en cours). Sans carte : « Prénom n'a pas de carte en cours. Créez d'abord une nouvelle carte. »
- Affichage (membre : profil « 🎟️ Ma carte activité » ; Eric : fiche membre) : 6 cases numérotées 1 à 5 puis 🎁 pour l'offerte, avec la DATE dans chaque case utilisée, « N séances restantes », « Il reste la séance offerte 🎁 » après la 5e, détail des séances (date + activité), cartes terminées en historique. Eric peut annuler une validation (petit ×). Sans carte : « Pas de carte en cours. Demandez une nouvelle carte à Eric pour vos prochaines séances. »
- 5ème séance validée : notification + email, UNE seule fois par carte (même si la validation est annulée puis refaite). Objet « Votre 5ème séance est utilisée — il vous en reste une offerte 🎁 », pastille « 🎁 1 séance offerte », texte : « Vous venez d'utiliser votre 5ème séance ([activité]), pas de panique ! Il vous en reste une offerte 🎁 Profitez-en bien sur l'eau ! Pour continuer à naviguer après cette séance offerte, pensez à reprendre une nouvelle carte auprès d'Eric. », liste des 5 séances avec leurs dates, boutons « Voir ma carte » et « Réserver ma séance offerte ».
- 6ème séance : notification + email « Votre carte activité est terminée — on continue ensemble ? ⛵ » (« Vous venez d'utiliser votre séance offerte : votre carte de 5 séances + 1 offerte est terminée. Bravo pour toutes ces navigations ! 👏 Pour continuer à réserver vos séances, demandez une nouvelle carte à Eric. », liste des 6 dates).

CARTE OBLIGATOIRE POUR RÉSERVER (option des Réglages, activée par défaut)
- Séances disponibles = séances restantes des cartes valables pour l'activité de la séance − réservations à venir pas encore validées (une réservation « occupe » une séance de la carte dès qu'elle est faite).
- Si 0 : la réservation (ou l'inscription d'un ami) est refusée avec la fenêtre « Carte activité nécessaire » : « Vous n'avez pas de carte activité en cours [pour cette activité]. Demandez une carte (5 séances + 1 offerte) à Eric pour réserver. » ou « Vous n'avez plus de séance disponible sur la carte activité : les séances restantes sont déjà réservées. Demandez une nouvelle carte à Eric. », bouton « Voir ma carte ».
- Eric peut toujours inscrire quelqu'un lui-même.

RÉCOMPENSES (8 couleurs de progression, attribuées à la main par Eric)
- Ordre : Blanc #F8FAFC, Jaune #FACC15, Jaune-orange (moitié #FACC15 / moitié #F97316), Orange #F97316, Orange-vert (moitié #F97316 / moitié #16A34A), Vert #16A34A, Bleu #2563EB, Violet #7C3AED. Les couleurs doubles s'affichent moitié-moitié, comme une ceinture.
- Chaque membre commence en Blanc. Badge « 🏅 Couleur » sur le profil, la liste et la fiche membre.
- Profil du membre : carte « 🏅 Ma récompense » : couleur actuelle, frise des 8 couleurs (obtenues allumées, l'actuelle encadrée), « Prochain objectif : … » (au Violet : « Bravo, vous avez atteint la plus haute récompense du club ! 🏆 »).
- Fiche membre côté Eric : carte « 🏅 Récompense » : les 8 couleurs à choisir, « Mot personnel (optionnel, ajouté à l'email) », bouton « Attribuer cette couleur » (fenêtre de confirmation) ; historique (de → vers, date, mot).
- Couleur SUPÉRIEURE : notification + email. Objet « Félicitations Prénom ! Vous passez à la couleur X 🏅 », grosse pastille de la couleur en haut, texte : « Félicitations ! Eric vous a attribué la couleur X 🎉 Cette nouvelle couleur récompense votre progression, votre régularité et votre engagement sur l'eau. Bravo ! Prochain objectif : la couleur Y. Continuez à naviguer régulièrement, à écouter les conseils et à oser de nouveaux défis — chaque séance vous en rapproche ! » (au Violet : « Vous avez atteint la plus haute récompense du club. Vous êtes un exemple pour tous les membres : continuez à partager votre passion et à faire progresser les autres ! »), le mot d'Eric encadré s'il y en a un, boutons « Voir ma progression » et « Réserver une séance ».
- Couleur INFÉRIEURE (correction) : aucun email.
```

**À vérifier :** créer une carte, valider 5 séances (email « pas de panique »), voir les dates dans les cases, réservation refusée sans carte, attribuer une couleur (email de félicitations).

---

## Message 6 — Membres existants, première connexion, mot de passe perdu, crédit, finitions

*(Joindre le logo `serenity-lotus.png` à ce message.)*

```
Ajoute l'arrivée des membres existants, l'aide au mot de passe et les finitions. Le logo de Serenity Life est joint.

IMPORT DES MEMBRES EXISTANTS (Membres › Importer, Eric seulement)
- Copier-coller (depuis Word, Excel, Google Sheets) ou fichier CSV/TSV : une ligne par membre « catégorie ; nom ; prénom ; téléphone » (séparateur tabulation, point-virgule ou virgule). Bouton « Vérifier » (aperçu des 10 premières lignes et nombre total), puis « Importer ».
- Nettoyage : nom en MAJUSCULES, prénom avec une majuscule ; catégorie normalisée (Opti Loisir, Multimono, Planche à voile (PAV), PAV Juniors, Multi supports, École de sport) ; les précisions comme « ( NR ) » ou « voir licence » deviennent la note privée d'Eric ; lignes sans nom ignorées ; doublons (même nom + prénom + 9 derniers chiffres du téléphone) ignorés.
- Les comptes importés sont « à activer » : pas d'email, pas de mot de passe, un identifiant prenom.nom. Résultat : « N membres ajoutés, M ignorés », puis la liste filtrée « à activer ».

PREMIÈRE CONNEXION / CODE D'ACCÈS (page publique)
- Deux onglets :
  (a) « Je suis membre » : nom, prénom, téléphone (« Pour un enfant, c'est souvent le téléphone d'un parent. »). Comparaison sans accents ni majuscules, sur les 9 derniers chiffres du téléphone (06…, +262 6…, 2626… équivalents). Uniquement pour un compte importé JAMAIS activé.
  (b) « J'ai un code » : le code donné par Eric (majuscules/minuscules et tiret indifférents).
- Ensuite : « Bonjour Prénom ! 👋 », « Votre identifiant : prenom.nom » (on peut se connecter avec l'identifiant ou l'email ; un email peut servir à plusieurs membres d'une famille), email, mot de passe + confirmation, et la case du règlement si pas encore accepté. Le compte devient actif, le membre est connecté et envoyé vers son profil si sa carte d'inscription est incomplète.
- Un compte « à activer » ne peut pas se connecter : message « Ce compte n'est pas encore activé. Utilisez « Première connexion / code d'accès » pour choisir votre mot de passe. »
- Une inscription d'une personne déjà dans la liste importée (même nom + prénom + téléphone) est refusée : « Vous êtes déjà dans la liste des membres du club : utilisez « Première connexion » pour activer votre compte. »

AIDER UN MEMBRE QUI A PERDU SON MOT DE PASSE (fiche membre, Eric)
- Carte « 🔑 Accès au compte » : identifiant, email (ou « pas encore donné »), statut (« Importé, jamais activé », « En attente : un code d'accès est actif », « Activé le … »).
- Bouton « 🔑 Effacer le mot de passe et créer un code d'accès » (confirmation) : efface le mot de passe, ferme toutes ses connexions, crée un code lisible XXXX-XXXX (sans 0/O/1/I), valable 7 JOURS, à USAGE UNIQUE, stocké haché. Affiché en grand à Eric (« Donnez ce code à Prénom… Identifiant : … ») pour le donner par téléphone/SMS, et envoyé par email si le membre en a un (« Votre nouveau code d'accès »).

CRÉDIT DU CRÉATEUR
- Pied de page UNIQUEMENT sur la première page (connexion, inscription, première connexion, mot de passe oublié) et la dernière (onglet Profil des membres, onglet Plus d'Eric), centré, discret :
  le logo lotus joint (~100 px de large), « Application créée par Serenity Life SAS », en gras « Besoin d'une application comme celle-ci ? Contactez Gladys », puis sur deux lignes « 📞 +262 639 55 29 74 » (lien d'appel) et « ✉️ contact@serenitytravellife.com » (lien mailto).
- Ces éléments viennent de variables de configuration du projet (CREDIT_NAME, CREDIT_PITCH, CREDIT_PHONE, CREDIT_EMAIL, CREDIT_LOGO) et ne sont PAS modifiables par le gérant dans l'application.

FINITIONS
- Sécurité : mots de passe hachés, sessions sécurisées (60 jours), limitation des tentatives de connexion, toutes les règles (24 h, places, licence, carte, droits gérant) vérifiées côté serveur, jamais seulement dans l'interface.
- Fenêtres de dialogue : sur mobile elles s'ouvrent depuis le bas ; Échap pour fermer ; boutons empilés sur mobile.
- Messages d'état (toasts) en bas : vert pour les succès, rouge pour les erreurs.
- États vides illustrés (« 🏝️ Aucune séance ce jour-là. », « ⛵ Aucune séance à venir. » + « Réserver une séance »).
- Accessibilité : contrastes suffisants, libellés sur tous les champs, focus visible.
- Hors connexion : « Pas de connexion internet. Vérifiez votre réseau et réessayez. »
- Données de démonstration DÉSACTIVABLES : 8 membres fictifs (licences variées : valide, sous 30 jours, sous 7 jours, expirée ; une carte « toutes activités » chacun) et le planning habituel sur 3 semaines.
```

**À vérifier :** importer 3 lignes de test, activer un compte avec nom + prénom + téléphone, se connecter avec l'identifiant, effacer un mot de passe et réactiver avec le code, crédit visible seulement sur Connexion / Profil / Plus.

---

## Avant de publier

1. **Compte gérant** : définissez le secret `ADMIN_PASSWORD` dans le projet Hercules, connectez-vous avec l'identifiant `eric`, changez le mot de passe dans Réglages et renseignez l'email d'Eric (il reçoit les alertes).
2. **Emails** : configurez l'expéditeur (idéalement une adresse du club) pour éviter les spams. Testez une réservation : l'email de confirmation doit arriver.
3. **Rappel H-24** : créez une séance qui commence dans un peu plus de 24 h, réservez-la, vérifiez que le rappel arrive à l'heure.
4. **Données de démonstration** : supprimez-les.
5. **Domaine** : publiez sur l'adresse fournie par Hercules ou sur votre propre domaine (ex. `ecole-voile.achm.fr`).
6. **Lancement** :
   - Eric ajuste ses niveaux et activités, puis crée le planning de la saison (« Nouvelle séance › Planning habituel »).
   - Eric importe la liste des membres (`membres-ACHM-import.tsv`).
   - Pendant les premières semaines, Eric peut désactiver « Carte activité obligatoire pour réserver » le temps de saisir les licences et de créer les cartes.
   - Partage du lien aux membres : « Première connexion / code d'accès ».

## Tests d'acceptation (une fois en ligne)

| Scénario | Résultat attendu |
|---|---|
| Inscription sans cocher le règlement | Refusée |
| Inscription d'un membre déjà importé | Renvoyé vers « Première connexion » |
| Première connexion avec nom + prénom + téléphone | Identifiant affiché, compte activé |
| Deux membres d'une famille avec le même email et mot de passe | « Qui se connecte ? » |
| Eric efface un mot de passe | Code XXXX-XXXX ; l'ancien mot de passe ne marche plus ; le code ne sert qu'une fois |
| Réservation sans licence saisie par Eric | Bloquée : « Transmettez votre licence à Eric » |
| Licence expirée avant la date de la séance | Bloquée + fenêtre explicative |
| Réservation sans carte (option activée) | « Carte activité nécessaire » |
| Carte avec 1 séance restante : 2 réservations | La 2e est refusée |
| 4 réservations sur une séance de PAV | La 5e personne voit « Complet » |
| Annulation à plus de 24 h | Place libérée, pas d'alerte |
| Annulation à moins de 24 h | Fenêtre rouge, historique, notification à Eric |
| Annulation dans l'heure suivant le rappel | Pas tardive |
| Eric change l'horaire d'une séance | Inscrits prévenus (notification + email) |
| 5ème séance validée | Email « pas de panique ! il vous en reste une offerte » (une seule fois) |
| Eric passe un membre de Blanc à Vert | Email de félicitations, prochain objectif Bleu |
| Licence qui expire dans 20 jours | Alerte « 30 jours » une seule fois, bandeau orange |
| Anniversaire d'un membre | Email à 00:00 (heure de Mayotte), une seule fois |
| Export CSV | S'ouvre dans Excel avec les accents |
| Crédit Serenity Life | Visible sur Connexion, Profil et Plus uniquement |
