# Guide de maintenance — Ma vidéothèque

## Projet

- Dépôt : `Doukyogit/mavideotheque`, branche `main`.
- Hébergement : GitHub Pages.
- Application : https://doukyogit.github.io/mavideotheque/
- Outils : https://doukyogit.github.io/mavideotheque/tools.html

## Architecture

L’application doit rester entièrement statique. Les pages et traitements s’exécutent dans le navigateur, en réponse aux actions de l’utilisateur.

Ne pas ajouter de backend, fonction cloud, workflow GitHub Actions, runner, cron, tâche planifiée, service worker, worker en arrière-plan, webhook, synchronisation automatique, commit automatique ou publication de données personnelles.

## Fichiers principaux

- `index.html` : catalogue, recherche TMDB, fiches de films, navigation, filtres et statistiques.
- `tools.html` : jeton TMDB, export Letterboxd, sauvegarde/restauration et comparaison Kodi.
- `mavideotheque-db.js` : accès à IndexedDB et gestion des sauvegardes.

## Données

La base IndexedDB `mavideotheque-local` contient les stores `meta`, `indexes`, `films` et `sagas`.

- Le catalogue, les fiches et les sagas sont conservés localement.
- Les caches de recherche et de détail TMDB sont stockés dans `meta`.
- Le jeton TMDB est enregistré dans IndexedDB sous `setting|tmdbToken`.
- L’adresse de l’hôte Kodi est enregistrée dans `meta`, sous la clé `setting|kodiIp`.
- Chaque navigateur possède sa propre base ; aucune synchronisation n’existe.

La sauvegarde `.jsonl.gz` comprend le catalogue, les fiches référencées et les sagas. Elle exclut le jeton TMDB, l’hôte Kodi et les paramètres/caches de `meta`. Elle n’est pas chiffrée.

L’import valide le fichier avant d’activer la nouvelle génération de données. En cas d’échec, la génération active est conservée.

## Réseau et sécurité

- Le site et le dépôt sont publics.
- Les requêtes TMDB transmettent les termes de recherche ou identifiants de films et utilisent le jeton Read Access dans l’en-tête `Authorization: Bearer`.
- Les notes et dates de visionnage ne sont pas envoyées à TMDB.
- La comparaison Kodi utilise une connexion WebSocket directe au réseau local et ne modifie pas Kodi. Le port 9090 n’est pas authentifié et ne doit pas être exposé à Internet.
- Les données du navigateur et les sauvegardes ne sont pas chiffrées.

## Méthode de modification

1. Récupérer la version actuelle et le SHA de chaque fichier concerné.
2. Examiner les usages avant de modifier ou supprimer du code.
3. Préserver les données locales, les notes, les dates et les champs des fiches.
4. Effectuer des changements ciblés.
5. Vérifier la syntaxe JavaScript et les dépendances des fichiers modifiés avec les moyens disponibles.
6. Relire les fichiers après publication et contrôler le fonctionnement de l’application.

Ne jamais annoncer une vérification comme réussie si elle n’a pas réellement été exécutée.

## En-tête et navigation — convention obligatoire

- Le style partagé de l’en-tête est centralisé dans `header.css`. Toute page HTML qui reprend l’en-tête doit charger cette feuille après ses styles propres : `<link rel="stylesheet" href="./header.css">`.
- Réutiliser la même structure : `.brandbar`, un titre `h1.brand-title` dont le lien pointe vers l’accueil, puis `.head-actions` contenant les liens d’icônes.
- Ne pas recopier les règles CSS de `.brandbar`, `.brand-title`, `.head-actions` ou de leurs icônes dans une page. Ne pas ajouter de règle locale qui les redéfinit, notamment dans les media queries.
- Les pages peuvent définir séparément le cadre du `header` (position, largeur, marge, arrière-plan) si leur mise en page l’exige, sans modifier la présentation commune des éléments internes.
- Le titre reste visible, neutre et non souligné ; il constitue le lien de retour à l’accueil. Les icônes restent sur une seule ligne, y compris sur mobile.
- Pour toute nouvelle page, reprendre la structure HTML et les classes existantes et charger `header.css` plutôt que créer un nouvel en-tête.

## Organisation du code — convention obligatoire

- Les scripts ne doivent pas être écrits directement dans les pages HTML. La page principale charge `js/common.js` puis `js/app.js` ; la page Outils charge `js/common.js` puis `js/tools.js`. Respecter cet ordre de chargement classique (sans `async` ni `defer`) tant que le code dépend de l’ordre global.
- Les utilitaires réellement communs (`# Guide de maintenance — Ma vidéothèque

## Projet

- Dépôt : `Doukyogit/mavideotheque`, branche `main`.
- Hébergement : GitHub Pages.
- Application : https://doukyogit.github.io/mavideotheque/
- Outils : https://doukyogit.github.io/mavideotheque/tools.html

## Architecture

L’application doit rester entièrement statique. Les pages et traitements s’exécutent dans le navigateur, en réponse aux actions de l’utilisateur.

Ne pas ajouter de backend, fonction cloud, workflow GitHub Actions, runner, cron, tâche planifiée, service worker, worker en arrière-plan, webhook, synchronisation automatique, commit automatique ou publication de données personnelles.

## Fichiers principaux

- `index.html` : catalogue, recherche TMDB, fiches de films, navigation, filtres et statistiques.
- `tools.html` : jeton TMDB, export Letterboxd, sauvegarde/restauration et comparaison Kodi.
- `mavideotheque-db.js` : accès à IndexedDB et gestion des sauvegardes.

## Données

La base IndexedDB `mavideotheque-local` contient les stores `meta`, `indexes`, `films` et `sagas`.

- Le catalogue, les fiches et les sagas sont conservés localement.
- Les caches de recherche et de détail TMDB sont stockés dans `meta`.
- Le jeton TMDB est enregistré dans IndexedDB sous `setting|tmdbToken`.
- L’adresse de l’hôte Kodi est enregistrée dans `meta`, sous la clé `setting|kodiIp`.
- Chaque navigateur possède sa propre base ; aucune synchronisation n’existe.

La sauvegarde `.jsonl.gz` comprend le catalogue, les fiches référencées et les sagas. Elle exclut le jeton TMDB, l’hôte Kodi et les paramètres/caches de `meta`. Elle n’est pas chiffrée.

L’import valide le fichier avant d’activer la nouvelle génération de données. En cas d’échec, la génération active est conservée.

## Réseau et sécurité

- Le site et le dépôt sont publics.
- Les requêtes TMDB transmettent les termes de recherche ou identifiants de films et utilisent le jeton Read Access dans l’en-tête `Authorization: Bearer`.
- Les notes et dates de visionnage ne sont pas envoyées à TMDB.
- La comparaison Kodi utilise une connexion WebSocket directe au réseau local et ne modifie pas Kodi. Le port 9090 n’est pas authentifié et ne doit pas être exposé à Internet.
- Les données du navigateur et les sauvegardes ne sont pas chiffrées.

## Méthode de modification

1. Récupérer la version actuelle et le SHA de chaque fichier concerné.
2. Examiner les usages avant de modifier ou supprimer du code.
3. Préserver les données locales, les notes, les dates et les champs des fiches.
4. Effectuer des changements ciblés.
5. Vérifier la syntaxe JavaScript et les dépendances des fichiers modifiés avec les moyens disponibles.
6. Relire les fichiers après publication et contrôler le fonctionnement de l’application.

Ne jamais annoncer une vérification comme réussie si elle n’a pas réellement été exécutée.

## En-tête et navigation — convention obligatoire

- Le style partagé de l’en-tête est centralisé dans `header.css`. Toute page HTML qui reprend l’en-tête doit charger cette feuille après ses styles propres : `<link rel="stylesheet" href="./header.css">`.
- Réutiliser la même structure : `.brandbar`, un titre `h1.brand-title` dont le lien pointe vers l’accueil, puis `.head-actions` contenant les liens d’icônes.
- Ne pas recopier les règles CSS de `.brandbar`, `.brand-title`, `.head-actions` ou de leurs icônes dans une page. Ne pas ajouter de règle locale qui les redéfinit, notamment dans les media queries.
- Les pages peuvent définir séparément le cadre du `header` (position, largeur, marge, arrière-plan) si leur mise en page l’exige, sans modifier la présentation commune des éléments internes.
- Le titre reste visible, neutre et non souligné ; il constitue le lien de retour à l’accueil. Les icônes restent sur une seule ligne, y compris sur mobile.
- Pour toute nouvelle page, reprendre la structure HTML et les classes existantes et charger `header.css` plutôt que créer un nouvel en-tête.

## Organisation du code — convention obligatoire

- Les scripts ne doivent pas être écrits directement dans les pages HTML. La page principale charge `js/common.js` puis `js/app.js` ; la page Outils charge `js/common.js` puis `js/tools.js`. Respecter cet ordre de chargement classique (sans `async` ni `defer`) tant que le code dépend de l’ordre global.
- , `esc`, validation du jeton TMDB) vivent dans `js/common.js` via `window.VideothequeCommon`. Le client HTTP TMDB est isolé dans `js/tmdb.js` via `window.VideothequeTMDB`. Ne pas en recopier une variante locale.
- Les styles de page vivent dans `css/app.css` et `css/tools.css`. Le style de navigation partagé reste dans `header.css`. Charger les CSS propres à la page avant `header.css`.
- Garder les responsabilités métier séparées : l’application principale dans `js/app.js`, les workflows d’administration et de sauvegarde dans `js/tools.js`, l’accès IndexedDB dans `mavideotheque-db.js`.
- Avant toute extraction ou modification, récupérer la version actuelle, préserver l’ordre d’initialisation et vérifier la syntaxe de chaque script classique. Ne pas convertir en modules ES sans traiter explicitement les dépendances et le routage.
- Toute nouvelle page doit réutiliser `js/common.js`, les styles communs et la structure d’en-tête existante plutôt que dupliquer les utilitaires.
