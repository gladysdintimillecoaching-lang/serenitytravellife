# Multimono ACHM — Kit d'installation sur Hercules

Hercules construit l'application en discutant avec son IA (frontend, base de données, connexion, emails, tâches planifiées et hébergement inclus).
Ce kit contient **les messages à copier-coller dans le chat Hercules, dans l'ordre**. Ils décrivent exactement l'application déjà construite et testée (dossier `multimono-achm/`), qui sert de référence.

**Mode d'emploi**
1. Créez un nouveau projet Hercules nommé **Multimono ACHM**.
2. Collez le **Message 1**, attendez que Hercules ait fini, vérifiez dans l'aperçu (checklist sous chaque message).
3. Passez au message suivant. Un message à la fois : l'IA travaille mieux par étapes.
4. À la fin, configurez l'expéditeur des emails et le domaine, puis cliquez sur **Publier**.

Astuce : si quelque chose ne correspond pas, répondez simplement à Hercules « Ce n'est pas conforme : … » en citant la règle du message concerné.

---

## Message 1 — Fondations, design et inscription

```
Crée une application web responsive, mobile en priorité, appelée « Multimono ACHM », pour le club de voile ACHM à Mayotte qui propose des sessions de multimono. Toute l'interface est en français. Fuseau horaire unique : Indian/Mayotte (UTC+3, pas d'heure d'été) — toutes les dates et heures affichées et saisies sont à l'heure de Mayotte.

DESIGN
- Thème inspiré de la mer. Couleurs : bleu abysse #0B3954 (titres, barre du haut), bleu océan #0E7490 (boutons principaux), turquoise #22B8CF (accents), lagon #5EEAD4, blanc écume #F7FCFD et fond #EAF6F8, sable #F6E7C8 (cartes secondaires), corail #F97352 (badges d'alerte), rouge #DC2626 (danger).
- Barre du haut avec un dégradé abysse → océan → turquoise et une petite vague blanche en bas. Logo : un voilier stylisé.
- Gros boutons arrondis (hauteur minimale 52 px), cartes blanches aux coins arrondis, navigation par onglets en bas de l'écran sur mobile (en haut sur ordinateur).
- Polices : Rubik pour les titres, Nunito Sans pour le texte.
- Application installable sur l'écran d'accueil (PWA).

RÔLES
1. Participant : s'inscrit, gère son profil, réserve et annule ses créneaux.
2. Gérant (Eric) : accès administrateur. Il se connecte avec un identifiant (« eric ») et un mot de passe. Un seul compte gérant, créé à l'installation.

CARTE D'INSCRIPTION DU PARTICIPANT (formulaire en 3 étapes avec barre de progression)
- Étape 1 « Vos coordonnées » : nom, prénom, date de naissance, téléphone, email ; contact d'urgence (nom + téléphone).
- Étape 2 « Licence et niveau » : numéro de licence, date d'obtention, date d'expiration (doit être après l'obtention), niveau de navigation choisi dans la liste des niveaux définis par Eric (afficher les niveaux avec leur couleur).
- Étape 3 « Votre compte » : mot de passe (8 caractères minimum) + confirmation, case obligatoire « J'ai lu et j'accepte le règlement du club » avec un lien qui ouvre le règlement dans une fenêtre.
- Enregistrer la date d'acceptation du règlement.
- Page de connexion : « Email (ou identifiant gérant) » + mot de passe, lien « Mot de passe oublié ? » (email avec lien valable 1 heure), et une carte sable « Nouveau au club ? Créer ma carte d'inscription ».

NIVEAUX DE NAVIGATION
- Table des niveaux : nom, couleur (code hex), ordre. Niveaux de départ : Découverte #38BDF8, Initié #14B8A6, Confirmé #F59E0B, Expert #EF4444.
- Eric crée, renomme, réordonne (flèches ▲▼), supprime les niveaux et choisit librement la couleur avec un sélecteur de couleur.
- Avant de supprimer, afficher combien de membres et de séances à venir l'utilisent ; ils passent alors en « non renseigné » / « Tous niveaux ».
- La couleur du niveau apparaît en badge (pastille arrondie, texte blanc) sur le profil du participant et dans toutes les listes d'Eric.

RÉGLAGES DU CLUB (modifiables par Eric, page « Réglages »)
- Nom de l'application : « Multimono ACHM »
- Lieu par défaut des séances : « Club de voile ACHM »
- Lien « Renouveler ma licence » : https://www.ffvoile.fr/ffv/web/licence/
- Règlement du club (texte long). Texte par défaut :
  « Règlement intérieur du club — Multimono ACHM
  1. Le port du gilet de sauvetage est obligatoire sur l'eau.
  2. Une licence en cours de validité est obligatoire pour participer aux séances.
  3. Toute annulation doit être faite au minimum 24 h avant la séance.
  4. Les consignes de sécurité du moniteur doivent être respectées à tout moment.
  5. Le matériel du club est utilisé avec soin et rincé après chaque séance. »
- Option « Bloquer les réservations sous le niveau requis » (désactivée par défaut).
- Eric peut aussi changer son prénom, son email (qui reçoit les alertes) et son mot de passe.

PROFIL DU PARTICIPANT
- En-tête avec initiales, nom, badge de niveau et badge de statut de licence (vert « Licence valide », orange « Expire dans N j », rouge « Licence expirée »).
- Formulaire pour modifier toutes les informations de la carte, changement de mot de passe, bouton « Lire le règlement », bouton « Se déconnecter ».
```

**À vérifier :** inscription en 3 étapes, connexion du gérant avec « eric », page Niveaux avec sélecteur de couleur, page Réglages.

---

## Message 2 — Séances, calendrier et réservation

```
Ajoute la gestion des séances et la réservation.

SÉANCES (créneaux)
- Une séance a : date et heure de début, heure de fin, nombre de places, niveau requis (ou « Tous niveaux »), lieu (vide = lieu par défaut), remarque optionnelle, et éventuellement une série (récurrence).
- PLANNING HABITUEL DU CLUB (repris de la feuille d'inscription utilisée jusqu'ici), modifiable dans Réglages sous forme de lignes jour / début / fin / places :
  • Samedi 12h00 – 14h30, 6 places
  • Samedi 15h00 – 17h30, 6 places
  • Dimanche 14h00 – 16h30, 6 places
- Page « Nouvelle séance » avec 3 modes :
  1. « Unique » : une date.
  2. « Récurrente » : jours de pratique (puces Lun…Dim), du … au …, afficher « N séances seront créées ».
  3. « Planning habituel » : du … au … ; crée toutes les séances du planning habituel sur la période, sans jamais créer de doublon si une séance existe déjà au même horaire. Afficher « N séances créées (M déjà existantes) ».
  Champs communs : début, fin (après le début), nombre de places (6 par défaut), niveau requis, lieu, remarque. Maximum 400 séances par création.

CALENDRIER DU PARTICIPANT (onglet « Calendrier »)
- Boutons « Semaine » / « Jour », navigation semaine précédente / suivante, bouton « Revenir à aujourd'hui », mention « Heure de Mayotte ».
- Vue semaine : séances groupées par jour (sur mobile, n'afficher que les jours qui ont des séances, plus aujourd'hui ; sur ordinateur, une grille de 7 colonnes).
- Vue jour : bandeau des 7 jours (un point sous les jours qui ont des séances), puis les séances du jour choisi.
- Chaque séance est une carte avec un liseré de la couleur du niveau : horaire en gros (ex. « 12h00 – 14h30 »), badge du niveau requis, lieu, remarque, barre de remplissage, texte « N places restantes » et « pris/total ».
- Les places restantes sont visibles par tous ; les NOMS des inscrits ne sont JAMAIS visibles par les participants (seulement par Eric).
- Bouton « Réserver ». Si la séance est pleine : bouton grisé « Complet ». Si déjà inscrit : badge vert « Inscrit(e) » + bouton « Annuler ». Séance passée : grisée, « Séance passée ».
- Rafraîchir automatiquement les places toutes les 30 secondes et au retour dans l'application.

RÉSERVATION EN UN CLIC
- Un clic sur « Réserver » réserve immédiatement, puis affiche une fenêtre « Réservation confirmée ! » avec la date et l'horaire, et « Un email de confirmation vous a été envoyé. Vous recevrez un rappel 24 h avant la séance. »
- Règles vérifiées côté serveur, de façon atomique (deux personnes ne peuvent jamais obtenir la dernière place en même temps) :
  • pas de réservation d'une séance déjà commencée ;
  • pas de double réservation de la même séance ;
  • pas de dépassement du nombre de places (les places prises = réservations actives + places réservées pour des invités, voir message 4) ;
  • LICENCE : si aucune licence n'est enregistrée, ou si la licence sera expirée à la DATE DE LA SÉANCE, la réservation est bloquée avec une fenêtre « Réservation bloquée » expliquant : « Votre licence ne sera plus valide à la date de cette séance. Pour des raisons d'assurance, la réservation est bloquée : renouvelez votre licence puis mettez à jour votre profil. » Boutons : « Renouveler ma licence » (ouvre le lien des Réglages) et « Mettre à jour mon profil ».
  • si l'option « Bloquer sous le niveau requis » est active : le niveau du participant doit être au moins égal (selon l'ordre des niveaux) au niveau requis.
- Le compte gérant ne réserve pas pour lui-même.

MES RÉSERVATIONS (onglet « Réservations »)
- Liste des séances à venir avec date, horaire, niveau, lieu, places.
- Si la séance commence dans moins de 24 h : bandeau orange « Séance dans moins de 24 h : une annulation serait tardive. »
- Bouton « Je confirme ma présence » (à partir de 25 h avant la séance, tant que ce n'est pas confirmé) ; une fois confirmé : badge « Présence confirmée ».
- Bouton « Annuler » sur chaque réservation (voir message 3).
```

**À vérifier :** créer le planning habituel sur 2 mois, réserver avec un compte participant, voir « Complet » quand 6 places sont prises.

---

## Message 3 — Annulation, règle des 24 h, rappels et notifications

```
Ajoute l'annulation, les notifications et les tâches automatiques.

ANNULATION PAR LE PARTICIPANT
- À CHAQUE annulation, afficher d'abord une fenêtre d'avertissement : titre « Annuler cette réservation ? », texte en gras « Toute annulation doit être faite au minimum 24 h avant la séance. », boutons « Retour » et « Annuler la séance » (rouge).
- Si la séance est dans PLUS de 24 h : annulation confirmée, la place est libérée immédiatement et visible par tous. Message : « Annulation confirmée : la place est libérée. »
- Si la séance est dans MOINS de 24 h : seconde fenêtre ROUGE (bordure rouge, icône 🚨) : titre « Annulation tardive », texte « Annulation tardive : vous risquez de perdre ce créneau. » et « La séance commence dans moins de 24 h. Le gérant sera informé de cette annulation. », boutons « Confirmer quand même » (rouge) et « Garder ma réservation ».
  • « Garder ma réservation » : rien ne change.
  • « Confirmer quand même » : la réservation passe au statut « annulation tardive », la place est libérée, une ligne est ajoutée à l'HISTORIQUE DES ANNULATIONS TARDIVES (nom du membre, séance, nombre d'heures avant le début, date de l'annulation — conservée même si la séance est supprimée plus tard), et Eric reçoit une notification + un email « Annulation tardive — Prénom Nom ».
- Exception : une annulation faite dans l'heure qui suit l'envoi du rappel H-24 (marge réglable, 60 minutes par défaut) n'est PAS tardive, puisque le rappel annonce que c'est la dernière limite.
- Le calcul « plus/moins de 24 h » se fait côté serveur.

NOTIFICATIONS DANS L'APPLICATION
- Une cloche dans la barre du haut avec un compteur de notifications non lues (rafraîchi chaque minute) ; page « Notifications » listant les 50 dernières, les non lues surlignées en turquoise ; tout passe en « lu » à l'ouverture de la page.
- Chaque notification importante est AUSSI envoyée par email (gabarit aux couleurs de l'application : bandeau dégradé bleu avec « ⛵ Multimono ACHM », tableau Date / Horaire / Niveau / Lieu, boutons arrondis, encadré sable pour les avertissements, lien « ouvrir l'application » en pied de page).
- Types de notifications :
  1. Confirmation de réservation (au participant).
  2. RAPPEL H-24 (voir ci-dessous).
  3. Séance modifiée par Eric (aux inscrits) : « Votre séance a été modifiée », avec la liste des changements (nouvelle date/horaire, niveau, lieu, remarque) et les nouvelles informations.
  4. Séance supprimée par Eric (aux inscrits) : « Séance annulée par le club », réservation annulée sans pénalité, bouton « Réserver un autre créneau ».
  5. Alerte de licence (30 jours puis 7 jours avant).
  6. Annulation tardive (à Eric).
  7. Message de bienvenue à l'inscription.

RAPPEL AUTOMATIQUE 24 H AVANT
- Tâche planifiée qui s'exécute CHAQUE MINUTE : pour chaque réservation active dont la séance commence dans 24 h ou moins (et n'a pas encore commencé) et qui n'a pas encore reçu de rappel, envoyer le rappel puis le marquer comme envoyé (jamais deux fois). Si Eric change l'heure de la séance, le rappel est réinitialisé.
- Pas de rappel pour une réservation faite moins de 24 h avant la séance (la confirmation suffit).
- Contenu (notification + email) : titre « Rappel : votre séance est dans 24 h ⛵ », date, horaire, niveau, lieu, et la phrase « C'est la dernière limite pour annuler sans risque de perdre votre créneau. »
- Deux boutons : « Je confirme ma présence » et « Annuler ma réservation ».
  • Dans l'application : les boutons agissent directement (l'annulation suit le même parcours avec avertissements).
  • Dans l'email : les boutons ouvrent une page de l'application via un lien signé et à durée limitée, qui fonctionne SANS se connecter : la page affiche la séance puis le bouton d'action (une simple ouverture du lien ne doit rien modifier, il faut cliquer).

ALERTES DE LICENCE
- Tâche planifiée quotidienne (ou chaque minute, sans doublon) : si la licence d'un participant expire dans 30 jours ou moins → alerte « Votre licence expire bientôt » ; dans 7 jours ou moins → alerte « Votre licence expire très bientôt ⏳ ». Chaque alerte n'est envoyée qu'une fois par date d'expiration (si le participant passe directement sous 7 jours, n'envoyer que l'alerte 7 jours). Si la date d'expiration change (renouvellement), les alertes repartent de zéro.
- Email avec boutons « Renouveler ma licence » (lien des Réglages) et « Mettre à jour mon profil ».
- BANDEAU dans le profil, le calendrier et « Mes réservations » :
  • 8 à 30 jours : bandeau orange « Votre licence expire dans N jours — Pensez à la renouveler pour continuer à réserver vos séances. » + bouton « Renouveler ma licence ».
  • 0 à 7 jours : même bandeau en rouge.
  • expirée ou absente : bandeau rouge « Votre licence est expirée — La réservation des séances est bloquée tant que votre licence n'est pas renouvelée et mise à jour dans votre profil. » + bouton.
  • Le bouton « Renouveler ma licence » ouvre le site de la fédération dans un nouvel onglet, puis amène le participant au formulaire Licence de son profil.

EMAILS
- Envoi via le service d'email intégré de Hercules, avec file d'attente et réessais en cas d'échec. Expéditeur : « Multimono ACHM ».
```

**À vérifier :** annuler une séance à plus de 24 h (place libérée), à moins de 24 h (fenêtre rouge + ligne dans l'historique + notification à Eric), recevoir un email de confirmation.

---

## Message 4 — Espace gérant (Eric)

```
Ajoute l'espace gérant, accessible uniquement au compte gérant (contrôle côté serveur sur toutes les actions). Onglets : Tableau, Séances, Membres, Plus.

TABLEAU DE BORD
- « Bonjour Eric 👋 » et bouton « Nouvelle séance ».
- 4 tuiles : séances aujourd'hui ; taux de remplissage de la semaine (anneau en %, et « places prises / places offertes ») ; licences à surveiller (expirées ou expirant sous 30 jours, chiffre en rouge s'il y en a) ; annulations tardives des 30 derniers jours.
- Séances du jour, liste des séances de la semaine avec une barre de remplissage (« 4/6 »), liste des membres dont la licence expire sous 30 jours ou est expirée (bandeau rouge « N licences expirées — ces membres ne peuvent plus réserver »).

SÉANCES
- Calendrier semaine/jour comme côté participant, mais chaque carte mène à la fiche de la séance ; bouton flottant « + » pour créer une séance.
- FICHE D'UNE SÉANCE :
  • horaire, niveau, lieu, remarque, appartenance à une série, barre de remplissage ; boutons « Modifier » et « Supprimer ».
  • Liste des inscrits NUMÉROTÉE de 1 au nombre de places (comme l'ancienne feuille « Inscription Multimono ») : d'abord les membres dans l'ordre d'inscription (pastille numérotée de la couleur de leur niveau, prénom + NOM, badge de niveau, statut de licence à la date de la séance, badge « ✓ Présence confirmée », contact d'urgence avec lien d'appel, bouton d'appel du membre, bouton ✕ pour le retirer), puis les invités/groupes (fond sable, badge « Invité » ou « Groupe · N places »), puis les places restantes affichées « Place libre » en pointillés.
  • Bouton « Inscrire un membre » : recherche d'un membre, puis inscription par Eric (pour les inscriptions par téléphone ou en direct) ; pas de contrôle de licence dans ce cas (Eric décide), mais le nombre de places est respecté ; le membre reçoit la confirmation.
  • Bouton « Invité / groupe » : nom, nombre de places (au maximum les places libres), téléphone et remarque optionnels ; réserve ces places pour une personne ou un groupe sans compte (exemple réel : « Anffane », 5 places).
  • Retirer un membre : la place est libérée, le membre est prévenu (« Réservation retirée par le gérant »), aucune pénalité. Retirer un invité libère ses places.
  • Section « Annulations » : liste des annulations de la séance (« À temps » ou « Tardive », date).
- MODIFIER une séance : date, début, fin, places (jamais moins que les places déjà prises — message d'erreur), niveau, lieu, remarque. Si la date, l'horaire, le niveau, le lieu ou la remarque change, tous les inscrits reçoivent automatiquement une notification + un email avec les changements. Bandeau d'information avant l'enregistrement : « N participants inscrits — ils recevront automatiquement une notification ».
- SUPPRIMER : « Supprimer cette séance » ou, si elle fait partie d'une série, « Supprimer celle-ci et les N suivantes ». Les inscrits des séances futures sont prévenus automatiquement (rappeler à Eric de prévenir lui-même les invités sans compte).

MEMBRES
- Recherche (nom, email, n° de licence) et filtres : niveau ; licence (toutes / valide / expire sous 30 jours / expirée ou absente).
- Chaque ligne : initiales sur la couleur du niveau, NOM Prénom, badge de niveau, badge de licence, badge rouge « N annul. tardives » le cas échéant.
- Bouton « Export CSV » (respecte les filtres) : séparateur point-virgule, encodage UTF-8 avec BOM pour Excel, colonnes : Nom ; Prénom ; Date de naissance ; Téléphone ; Email ; Contact urgence ; Tél. urgence ; N° licence ; Obtention licence ; Expiration licence ; Statut licence ; Niveau ; Annulations tardives ; Inscrit le. Protéger contre l'injection de formules (préfixer d'une apostrophe les cellules commençant par = + - @).
- Fiche membre : toute la carte d'inscription, changement de niveau par Eric, séances à venir, historique de ses annulations tardives, bouton « Supprimer ce membre » (avec confirmation).

PLUS
- Liens vers : Notifications, Annulations tardives (historique complet, du plus récent au plus ancien : membre, séance, « annulée X,X h avant », date), Niveaux de navigation, Réglages, Se déconnecter.
```

**À vérifier :** fiche séance numérotée 1–6 avec « Place libre », ajout d'un groupe de 2 places, export CSV ouvert dans Excel.

---

## Message 5 — Sécurité, finitions et données de test

```
Finalise l'application :
- Sécurité : mots de passe hachés, sessions sécurisées, limitation des tentatives de connexion, toutes les règles (24 h, places, licence, droits gérant) vérifiées côté serveur et jamais seulement dans l'interface.
- Fenêtres de dialogue : sur mobile elles s'ouvrent depuis le bas de l'écran ; touche Échap pour fermer ; boutons empilés sur mobile.
- Messages d'état (toasts) en bas de l'écran : vert pour les succès, rouge pour les erreurs.
- États vides illustrés (ex. « 🏝️ Aucune séance ce jour-là. », « ⛵ Aucune séance à venir. » avec un bouton « Réserver une séance »).
- Accessibilité : contrastes suffisants, libellés sur tous les champs, focus visible.
- Hors connexion : message clair « Pas de connexion internet. Vérifiez votre réseau et réessayez. »
- Crée des données de démonstration désactivables : 8 membres fictifs avec des licences variées (valide, expire sous 30 jours, sous 7 jours, expirée) et le planning habituel sur 3 semaines, pour que je puisse tester.
```

---

## Avant de publier

1. **Compte gérant** : connectez-vous avec l'identifiant `eric`, changez le mot de passe dans Réglages et renseignez l'email d'Eric (il reçoit les alertes).
2. **Emails** : dans Hercules, configurez l'expéditeur (idéalement une adresse du club) pour que les emails n'arrivent pas en spam. Testez une réservation : l'email de confirmation doit arriver.
3. **Rappel H-24** : créez une séance qui commence dans un peu plus de 24 h, réservez-la, et vérifiez que le rappel arrive à l'heure.
4. **Données de démonstration** : supprimez-les avant le lancement.
5. **Domaine** : publiez sur l'adresse fournie par Hercules ou sur votre propre domaine (ex. `multimono.achm.fr`).
6. **Lancement** : Eric crée ses niveaux, lance le planning habituel de la saison, puis partage le lien aux membres.

## Tests d'acceptation (à faire une fois en ligne)

| Scénario | Résultat attendu |
|---|---|
| Inscription sans cocher le règlement | Refusée |
| 6 réservations sur une séance de 6 places | La 7e personne voit « Complet » |
| Licence expirée avant la date de la séance | Réservation bloquée + fenêtre explicative |
| Annulation à plus de 24 h | Place libérée, pas d'alerte |
| Annulation à moins de 24 h | Fenêtre rouge, historique, notification à Eric |
| Annulation dans l'heure suivant le rappel | Pas comptée comme tardive |
| Eric change l'horaire d'une séance | Les inscrits reçoivent notification + email |
| Licence qui expire dans 20 jours | Alerte « 30 jours » une seule fois, bandeau orange |
| Export CSV | S'ouvre correctement dans Excel avec les accents |
