# Ma vidéothèque

Application web statique de gestion d’une vidéothèque personnelle.

- **Application :** https://doukyogit.github.io/mavideotheque/
- **Outils :** https://doukyogit.github.io/mavideotheque/tools.html

## Fonctions

- Catalogue personnel : recherche, filtres, tri et statistiques.
- Recherche de films et fiches détaillées via TMDB.
- Ajout explicite des films au catalogue.
- Notes personnelles et dates de visionnage.
- Export CSV compatible avec Letterboxd.
- Sauvegarde complète, vérification et restauration.
- Comparaison en lecture seule avec une bibliothèque Kodi du réseau local.

## Données et stockage

Les données sont enregistrées dans le navigateur, dans IndexedDB : catalogue, fiches de films, sagas, caches TMDB et jeton TMDB. L’adresse de l’hôte Kodi est conservée dans IndexedDB.

Chaque navigateur possède ses propres données. Il n’y a pas de synchronisation entre appareils.

La sauvegarde complète est un fichier `.jsonl.gz` créé localement. Elle contient le catalogue, les fiches de films et les sagas. Elle n’inclut ni le jeton TMDB, ni l’adresse Kodi, ni les paramètres et caches TMDB. Le fichier n’est pas chiffré ; son stockage et son transfert sont à la charge de l’utilisateur.

## Services externes et confidentialité

- Le site et son dépôt sont publics.
- Les recherches et demandes de fiches transmettent à TMDB les termes recherchés ou les identifiants de films. Le jeton TMDB est envoyé dans l’en-tête d’autorisation et reste stocké localement dans le navigateur.
- Les notes et dates de visionnage restent dans la base locale et ne sont pas transmises à TMDB.
- L’export Letterboxd est généré localement.
- La comparaison Kodi communique directement avec Kodi sur le réseau local, en lecture seule. Le port WebSocket 9090 n’étant pas authentifié, ne pas l’exposer à Internet.
- Le stockage du navigateur et les fichiers de sauvegarde ne sont pas chiffrés. Utiliser un appareil et un profil de navigateur de confiance.

## Fonctionnement technique

L’application est composée de fichiers HTML, CSS et JavaScript statiques hébergés par GitHub Pages. Les traitements s’exécutent dans le navigateur à la suite des actions de l’utilisateur. Aucun serveur applicatif ni synchronisation distante des données personnelles n’est utilisé.
