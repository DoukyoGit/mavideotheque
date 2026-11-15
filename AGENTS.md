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
