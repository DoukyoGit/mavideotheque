# AGENTS.md — Ma vidéothèque

Guide de maintenance destiné aux développeurs et assistants IA. Le dépôt et son code sont la source de vérité : toujours relire les versions actuelles avant toute modification.

## Projet
- Dépôt : `DoukyoGit/mavideotheque`, branche `main`.
- Hébergement : GitHub Pages ; dépôt public ; application statique HTML/CSS/JavaScript, sans framework ni backend.
- Site : `https://doukyogit.github.io/mavideotheque/`.
- Outils : `https://doukyogit.github.io/mavideotheque/tools.html`.
- `index.html` contient la grille, les fiches via fragment et les statistiques.
- `tools.html` contient l'ajout/modification et les exports CSV.
- `ajouter-film.html` redirige vers `tools.html`.
- `data/index.json` contient le résumé complet ; `data/films/t<ID>.json` contient les fiches détaillées.

## Fonctionnement

### Application
- Charge `data/index.json` au démarrage.
- Recherche sur titre, titre original et réalisateur ; tri par date, note, titre, durée ou réalisateur.
- Filtres par note, durée, période, réalisateur et genre.
- Affichage progressif par lots de 120 films.
- Fiche détaillée via `#film/<id>`, chargée à la demande.
- Statistiques intégrées via `#stats`.

### Outil d'administration
Deux parcours indépendants :
1. **Ajout / mise à jour manuelle** : recherche TMDB, saisie de note/date, file d'opérations, export ZIP ou publication directe GitHub.
2. **Export Trakt / Letterboxd** : génération locale de CSV à partir de l'index publié ; N films les plus récemment visionnés avec date valide ; aucun compte, jeton ou OAuth requis.

La publication directe utilise l'API Git Data de GitHub pour créer un commit unique sur `main`, avec mise à jour non forcée de la référence. Le jeton GitHub fine-grained doit être limité au dépôt et à `Contents: Read and write`.

## Sécurité et confidentialité
- Le dépôt, le site, les JSON et l'historique Git sont publics. `noindex` et `robots.txt` réduisent la découvrabilité mais ne protègent pas l'accès.
- Ne jamais intégrer de secret dans le code, les données, les ZIP, les commits ou les logs.
- Le jeton TMDB Read Access est envoyé dans l'en-tête `Authorization: Bearer`. Il reste en mémoire par défaut ; la case « Mémoriser » active explicitement son stockage dans `localStorage`.
- Le jeton GitHub reste en mémoire par défaut ; sa mémorisation est facultative.
- `localStorage` n'est pas chiffré et reste accessible à tout JavaScript exécuté sur la même origine. Utiliser un appareil de confiance, des jetons à durée courte et des permissions minimales.
- Les anciennes sauvegardes locales TMDB sont effacées au premier chargement de la version qui introduit la mémorisation facultative.
- Les pages principales ont une CSP limitant les connexions aux API TMDB/GitHub et les images à TMDB. `tools.html` autorise également les WebSockets (`ws:`) pour la connexion directe au Kodi local. Si un domaine ou transport change, réviser la CSP.
- L’interface Kodi WebSocket (port TCP 9090 par défaut) n’a pas d’authentification. Ne jamais l’exposer à Internet ; l’activer uniquement sur un réseau local de confiance. Le navigateur peut demander l’autorisation d’accès au réseau local.
- Toute nouvelle page publiée doit conserver les directives anti-indexation. Cela ne constitue pas une authentification.
- Pour une vraie confidentialité, utiliser un contrôle d'accès côté serveur et ne pas publier les données privées dans un dépôt public.

## Modèle de données et invariants
L'index contient `version`, `generatedAt`, `count`, `films`. Champs abrégés courants :
- `id` : identifiant interne (généralement `t<TMDB_ID>`) ;
- `t`, `o`, `y` : titre, titre original, année ;
- `d`, `r`, `w` : réalisateurs, note personnelle, date de visionnage ;
- `m`, `g`, `p`, `s` : durée, genres, affiche, statut.
Des champs additionnels peuvent exister : les préserver.

Une fiche détaillée contient notamment `id`, `key`, `csv`, `status`, `tmdb`, `extra`. Les champs facultatifs peuvent être absents, nuls ou vides.

Règles impératives :
- Nom de fichier, ID de la fiche et ID de l'index doivent correspondre.
- Toute modification doit synchroniser la fiche et l'entrée d'index.
- Toujours partir de l'index complet ; ne jamais publier un index partiel.
- Préserver les notes, dates et autres données personnelles.
- Ne pas normaliser les identifiants internes sans migration vérifiée.
- Avant de supprimer une propriété TMDB ou `extra`, rechercher tous ses usages.

## Interface et conventions
- Interface française, responsive, palette crème/rouge et thème sombre système.
- HTML/CSS/JavaScript natifs ; limiter les dépendances.
- Maintenir la cohérence visuelle et l'accessibilité (labels, focus visible, boutons typés).
- Échapper les données dynamiques avant insertion HTML.
- Préserver le chargement paresseux des images et le rendu progressif.
- Conserver directives robots et CSP.

## Vérifications
Lancer avec Node.js 22 ou supérieur :
```sh
node scripts/validate.mjs
```
Le script valide la syntaxe des scripts inline, le JSON, les dates/notes, le nombre de fiches et la concordance index/fichiers. GitHub Actions exécute ce contrôle sur les pushs et pull requests.

## Procédure de modification

1. Identifier les fichiers réellement concernés par la demande.
2. Relire leur dernière version sur `main` et récupérer leur SHA avant modification.
3. Ne pas charger systématiquement les fichiers de données (`data/films/`, `data/sagas/`).
4. Consulter les données uniquement lorsqu'une modification touche leur structure, leur contenu ou leur traitement.
5. Avant de supprimer ou renommer une fonction, variable, propriété ou sélecteur, rechercher ses usages dans le code source.
6. Pour les modifications de données, préserver les données personnelles et synchroniser les fichiers concernés avec l'index.
7. Faire des changements ciblés, sans réécrire les fichiers ou données non concernés.
8. Lancer `node scripts/validate.mjs` lorsque la modification le justifie. Ce script contrôle lui-même l'ensemble des données : il n'est pas nécessaire de les charger dans le contexte de l'agent.
9. Après modification, vérifier le diff, les fichiers concernés et les éventuelles régressions liées au changement.
10. Après commit, vérifier le commit et les fichiers modifiés, sans relire l'intégralité du dépôt.

## Règles de consultation des données

- `data/index.json` : à consulter lorsque la modification concerne la liste des films, la recherche, les tris, les filtres, les statistiques ou les opérations de synchronisation.
- `data/films/` : consulter uniquement les fiches nécessaires lorsqu'on travaille sur les données détaillées d'un film.
- `data/sagas/` : consulter uniquement les sagas concernées.
- Ne jamais relire toutes les fiches JSON par défaut.
- Pour vérifier l'intégrité globale des données, privilégier `scripts/validate.mjs` plutôt que leur chargement dans le contexte de l'agent.

## Checklist de régression
- Index, recherche, tri, filtres et pagination.
- Fiches détaillées et champs facultatifs absents.
- Statistiques et filtres déclenchés depuis les statistiques.
- Ajout/modification, conservation des notes/dates, ZIP et publication GitHub.
- Exports Trakt/Letterboxd, tri et limite sélectionnée.
- Mobile, thème clair/sombre, navigation retour.
- Aucun secret committé ; index et fiches synchronisés.
