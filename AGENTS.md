# Guide de maintenance — Ma vidéothèque

## Projet et contraintes

- Dépôt : `Doukyogit/mavideotheque`, branche `main`.
- Hébergement : GitHub Pages ; application statique exécutée dans le navigateur.
- Ne pas ajouter de backend, fonction cloud, workflow GitHub Actions, cron, tâche planifiée, worker, service worker, webhook, synchronisation automatique ou publication automatique de données personnelles.
- Les traitements doivent rester déclenchés par les actions de l’utilisateur.

## Architecture et fichiers

- `index.html` : catalogue, fiches, découverte, Kodi et statistiques.
- `tools.html` : jeton TMDB, export Letterboxd, sauvegardes, doublons et comparaison Kodi.
- `mavideotheque-db.js` : accès à IndexedDB et gestion des sauvegardes.
- `js/common.js` : utilitaires réellement communs aux pages, exposés via `window.VideothequeCommon`.
- `js/tmdb.js` : client HTTP TMDB partagé, exposé via `window.VideothequeTMDB`.
- `js/tools.js` : fonctionnalités de la page Outils.
- `js/app.js` : catalogue, affichage général, recherche locale, filtres et tri.
- `js/app-film.js` : fiches de films et sagas.
- `js/app-kodi.js` : affichage de la bibliothèque Kodi.
- `js/app-stats.js` : statistiques et initialisation de l’application.
- `js/app-discover.js` : découverte TMDB, recherche TMDB et transformation des données de films.

### Ordre de chargement obligatoire

Dans `index.html`, charger dans cet ordre, sans `async` ni `defer` :

1. `mavideotheque-db.js`
2. `js/common.js`
3. `js/tmdb.js`
4. `js/app.js`
5. `js/app-film.js`
6. `js/app-kodi.js`
7. `js/app-stats.js`
8. `js/app-discover.js`

Dans `tools.html`, charger `mavideotheque-db.js`, puis `js/common.js`, puis `js/tools.js`.

Les scripts de l’application principale sont des scripts classiques partageant le même environnement lexical global. Ne pas redéclarer dans plusieurs fichiers les mêmes variables globales avec `const` ou `let`. Les fonctions communes aux deux pages doivent aller dans `js/common.js`, et non être recopiées dans les fichiers métier. Le client TMDB reste dans `js/tmdb.js`.

Lors d’un déplacement de code entre fichiers, conserver strictement l’ordre d’exécution et les dépendances. Ne pas convertir en modules ES ni ajouter de chargement dynamique sans traiter explicitement ces dépendances.

## Données locales

La base IndexedDB `mavideotheque-local` contient les stores `meta`, `indexes`, `films` et `sagas`.

- Catalogue, fiches, notes, dates de visionnage et sagas sont conservés localement.
- Les caches TMDB sont stockés dans `meta`.
- Le jeton TMDB est enregistré sous `setting|tmdbToken`.
- L’adresse Kodi est enregistrée sous `setting|kodiIp`.
- Chaque navigateur possède sa propre base ; aucune synchronisation entre appareils n’existe.

La sauvegarde `.jsonl.gz` contient le catalogue, les fiches référencées et les sagas. Elle exclut le jeton TMDB, l’adresse Kodi et les paramètres/caches. Elle n’est pas chiffrée. L’import valide le fichier avant d’activer la nouvelle génération ; en cas d’échec, la génération active est conservée.

## Réseau et sécurité

- Le site et le dépôt sont publics.
- Les requêtes TMDB transmettent les termes recherchés ou identifiants de films et utilisent le jeton Read Access dans l’en-tête Bearer.
- Les notes et dates personnelles ne sont pas envoyées à TMDB.
- Kodi est contacté directement sur le réseau local en WebSocket, en lecture seule. Le port 9090 n’est pas authentifié et ne doit jamais être exposé à Internet.
- Les données locales et les sauvegardes ne sont pas chiffrées.

## Présentation commune

- L’en-tête partagé est défini dans `header.css`. Toute page qui l’utilise charge cette feuille après ses styles propres.
- Reprendre la structure `.brandbar`, `h1.brand-title` et `.head-actions`.
- Ne pas dupliquer ni redéfinir localement les styles de ces éléments, y compris dans les media queries.
- Le titre « Ma vidéothèque » reste neutre, non souligné et pointe vers l’accueil. Les icônes restent sur une seule ligne, y compris sur mobile.

## Méthode de maintenance et publication

1. Récupérer les versions actuelles et les SHA des fichiers concernés.
2. Examiner les usages et dépendances avant toute modification ou suppression.
3. Préserver les données locales, notes, dates et champs des fiches.
4. Privilégier les changements ciblés ; éviter les refontes sans nécessité.
5. Vérifier la syntaxe de chaque script JavaScript classique modifié et l’équilibre des accolades CSS.
6. Relire les fichiers après publication et vérifier les références/cache-busters dans les pages HTML.
7. Annoncer uniquement les vérifications réellement effectuées et toujours communiquer le SHA complet du commit publié.

Ne jamais affirmer qu’un changement est publié ou fonctionnel avant d’avoir vérifié le commit et relu les fichiers concernés.
