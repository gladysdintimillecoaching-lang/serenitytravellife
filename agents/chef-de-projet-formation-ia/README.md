# Agent « Chef de projet – Formation IA en ligne » sur Claude Managed Agents

Cet agent fait le même travail que la tâche programmée « Chef de projet – Formation IA en ligne » déjà active dans votre compte Claude. Il tourne cette fois sur les serveurs d'Anthropic avec Claude Managed Agents.

Chaque jour de semaine à 6h47 (heure de Mayotte), il :
1. lit le planning sur Google Drive ;
2. prend en compte vos réponses FAIT / REPORTER / BLOQUÉ envoyées par e-mail ;
3. vérifie votre agenda et reporte les étapes en retard ;
4. prépare un brouillon quand c'est possible (scripts, e-mails, page de vente…) ;
5. vous envoie l'e-mail « [Formation IA] Tâche du JJ/MM ».

> **À savoir :** n'activez pas cette version en même temps que la tâche programmée, sinon vous recevrez deux e-mails par jour. Mettez la tâche programmée en pause au moment où vous lancez celle-ci (étape 6).

## Les fichiers

| Fichier | Rôle |
|---|---|
| `agent.md` | L'agent : modèle, outils, accès Google et instructions |
| `environment.yaml` | L'espace de travail de l'agent : pas d'accès web, seulement Google |
| `vault.yaml` | Le coffre-fort où Anthropic garde vos accès Google (aucun secret dans ce fichier) |
| `deployment-quotidien.yaml` | Le lancement automatique du lundi au vendredi à 6h47, avec un plafond de dépense de 2 $ par jour |

## Ce qu'il vous faut

1. **Un compte développeur Anthropic** sur console.anthropic.com, avec un moyen de paiement. C'est un paiement à l'usage, séparé de votre abonnement Claude.
2. **L'outil en ligne de commande `ant`**, version 1.34 ou plus récente.
3. **Des serveurs MCP pour Google Drive, Google Agenda et Gmail**, avec leurs jetons de connexion (OAuth). C'est l'étape la plus technique.

## Étapes

### 1. Installer `ant` et se connecter
```sh
brew install anthropics/tap/ant      # sur Mac
ant auth login                       # ouvre le navigateur pour vous connecter
ant auth status                      # vérifie la connexion
```

### 2. Vérifier ce qui va être créé, sans rien créer
Depuis la racine du dépôt :
```sh
ant apply --dry-run -v agents/chef-de-projet-formation-ia/agent.md agents/chef-de-projet-formation-ia/environment.yaml agents/chef-de-projet-formation-ia/vault.yaml
```

### 3. Brancher Google
- Dans `agent.md`, remplacez les trois adresses `https://REMPLACER-…` par celles des serveurs MCP Google que vous utilisez.
- Obtenez pour chacun un jeton de connexion OAuth (avec son jeton de renouvellement), en suivant la documentation du serveur choisi.
- Ces jetons ne vont jamais dans les fichiers. On les ajoute au coffre-fort après sa création (étape 4) :
```sh
ant beta:vaults:credentials create --help   # affiche les champs à remplir
```
Chaque accès est rattaché à l'adresse exacte d'un serveur MCP (type `mcp_oauth`).

### 4. Créer l'agent, l'environnement et le coffre-fort
```sh
ant apply agents/chef-de-projet-formation-ia/agent.md agents/chef-de-projet-formation-ia/environment.yaml agents/chef-de-projet-formation-ia/vault.yaml
```
- Ouvrez `claude-lock.json` (créé à la racine du dépôt) et copiez l'identifiant du coffre-fort, qui commence par `vlt_`.
- Ajoutez-y vos accès Google (étape 3).
- Collez l'identifiant dans `deployment-quotidien.yaml` : `vault_ids: [vlt_...]`.

### 5. Activer le lancement quotidien
```sh
ant apply agents/chef-de-projet-formation-ia/deployment-quotidien.yaml
```
Pour tester tout de suite sans attendre 6h47, lancez un run manuel (remplacez `depl_...` par l'identifiant du lancement automatique, que vous trouverez dans `claude-lock.json`) :
```sh
curl -fsSL -X POST https://api.anthropic.com/v1/deployments/depl_.../run \
  -H "Authorization: Bearer $(ant auth print-credentials --access-token)" \
  -H "anthropic-version: 2026-10-21" \
  -H "anthropic-beta: managed-agents-2026-04-01,oauth-2025-04-20"
```
Vous suivez le déroulé dans la Console (rubrique des sessions). Vérifiez que l'e-mail arrive et que le planning est bien mis à jour sur le Drive.

### 6. Basculer
Une fois le test réussi, mettez en pause la tâche programmée « Chef de projet – Formation IA en ligne » dans claude.ai, pour ne recevoir qu'un seul e-mail par jour.

## Ensuite
- **Mettre en pause :** `POST /v1/deployments/<id>/pause`, ou depuis la Console.
- **Modifier les instructions :** éditez `agent.md`, puis relancez `ant apply` (une nouvelle version est créée).
- **Fin du projet :** l'agent vous envoie un e-mail final. Vous pouvez alors mettre le lancement automatique en pause.

## Sécurité
- Les outils Google sont autorisés d'avance, car personne n'est là pour valider à 6h47. Les instructions limitent l'agent à votre propre adresse e-mail, au dossier « 08 - Formation IA Claude » et à la lecture de votre agenda.
- Les accès Google restent dans le coffre-fort d'Anthropic et ne sont jamais visibles par l'agent.
- Le plafond de 2 $ par run évite toute mauvaise surprise sur la facture.
