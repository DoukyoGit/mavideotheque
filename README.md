# Ma vidéothèque

Application de suivi de films publiée avec GitHub Pages.

- **Site :** https://doukyogit.github.io/mavideotheque/
- **Outils :** https://doukyogit.github.io/mavideotheque/tools.html

## Fonctionnalités
- Catalogue avec recherche, tri et filtres.
- Fiches détaillées enrichies par TMDB.
- Statistiques personnelles de visionnage.
- Ajout et correction de films depuis l'outil d'administration.
- Export CSV des films récemment vus vers Trakt et Letterboxd.
- Comparaison en lecture seule des statuts de visionnage avec Kodi via JSON-RPC WebSocket (IP manuelle, port 9090 par défaut).

## Données
- `data/index.json` contient le résumé complet de la collection.
- `data/films/` contient une fiche détaillée par film.
- L'index et les fiches doivent rester synchronisés.
- L'application est statique : GitHub Pages ne fournit ni backend ni authentification.

## Confidentialité et sécurité
Le dépôt et le site sont publics. Les directives anti-indexation et `robots.txt` réduisent la découvrabilité mais ne protègent pas les fichiers : toute personne connaissant une URL peut consulter les données publiées.

Les jetons TMDB et GitHub restent en mémoire par défaut ; leur mémorisation est facultative. L’adresse IP Kodi est mémorisée localement dans le navigateur. Le stockage local n'est pas chiffré et n'est pas un coffre-fort. Utiliser uniquement un appareil de confiance et des jetons à droits minimaux. Ne jamais publier de secret dans le dépôt. La connexion Kodi utilise le port WebSocket 9090 par défaut et nécessite d’autoriser le contrôle à distance par les applications d’autres systèmes dans Kodi. Cette interface n’est pas authentifiée : ne jamais l’exposer à Internet et ne l’activer que sur un réseau local de confiance.

## Maintenance
Aucune dépendance npm n'est nécessaire. Avec Node.js 22 ou supérieur :
```sh
node scripts/validate.mjs
```
