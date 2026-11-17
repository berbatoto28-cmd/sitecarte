# AnimeConnection V15 — Astral & ouverture ×10

Cette version contient **58 942 cartes**, dont **6 373 personnages supplémentaires** provenant des fiches d'œuvres AniList mises en cache et **2 569 éditions Astral**, une pour chaque série normale. Les 50 000 identifiants antérieurs sont conservés. Les rééquilibrages de puissance éditoriaux couvrent 116 cartes dans les grands univers. La popularité provient du compteur de favoris AniList (une indication, non une vérité absolue) et la puissance repose sur une sélection éditoriale de personnages des univers de combat.

**Astral** : rareté extrêmement basse, plus rare que Primordiale ; elle est invisible dans la boutique et les filtres avant la première obtention réelle. Les cartes Astral non obtenues ne figurent pas dans le classeur. Chaque Astral utilise un full art cosmique original, une illustration du personnage et son nom vertical sur le côté gauche. Le Pack Test Ultime donne désormais six raretés (dont Astral) en **démo uniquement**, sans cartes conservées. Son tirage n'active pas Astral dans le classeur.

**Ouverture ×10** : acheter/ouvrir 10 packs simultanément, avec écran affichant les 10 lots et leurs 50 cartes ; taux et fidélité identiques à dix ouvertures successives. Les stocks et les Coins sont vérifiés dans une seule transaction, sans achat partiel. Les packs gratuits se stockent jusqu'à 10 ; les packs quotidiens et le cadeau Secret restent individuels. Sur un stock inférieur à 10, le bouton de la réserve ouvre le nombre disponible (de 2 à 10).

**Sauvegardes** : la base `data/animeconnection.db` n'est pas incluse dans l'archive. Conservez la base de votre installation actuelle. Sur une installation existante, ne remplacez pas ce fichier ; le serveur réutilise les comptes et collections de la base en place.

**Reconstruction** : `npm run cards` reconstruit le socle de 50 000 cartes puis réapplique `tools/upgrade-v15.mjs`. Pour réappliquer l'extension aux données actuelles sans reconstruction : `node tools/upgrade-v15.mjs`. Les listes de changements sont dans `tools/audit/v15_*.csv`.

**Images** : les portraits des personnages viennent de références AniList distantes et ne sont pas tous en haute définition ni garantis disponibles en permanence. L'illustration cosmique `public/art/astral-cosmos.webp` est locale et originale ; elle ne remplace pas les images des personnages.

---

# AnimeConnection — édition 50 000 cartes

Jeu de collection de cartes anime/manga, **100 % gratuit**, dans la direction artistique originale violette et néon.

## Nouveautés de cette édition

- **50 000 cartes réelles dans le catalogue**, réparties sur **2 569 séries anime/manga** et trois collections spéciales : **Summer Waifus**, **Légendes du Shōnen** et **Les Grands Méchants**.
- Les **sept raretés d'origine** sont conservées : Commune, Rare, Épique, Légendaire, Mythique, Secrète, Primordiale.
- **Animations de révélation à partir de Légendaire**, adaptées à chaque palier : lumière dorée pour Légendaire ; portail rose pour Mythique ; prisme pour Secrète ; halo cosmique doré pour Primordiale. Les cartes Secrètes et Primordiales gardent leur **Full Art**.
- **Collections existantes préservées** : les identifiants des 320 cartes historiques restent présents dans le nouveau set. Le fichier de sauvegarde du jeu est conservé.
- **Classeur paginé** : recherche sur les 50 000 cartes, filtre par série, rareté, possession et numéro, 48 cartes chargées par page seulement.
- **Packs par série recherchables** : 30 packs 3D maximum en même temps ; moteur de recherche sur les milliers de séries.
- **Packs Édition spéciale** : 5 cartes à taux premium, 10 % de chance par pack d'une carte collector Légendaire ou mieux de l'édition choisie ; aucune Légendaire garantie.
- Le marché, les échanges, les missions quotidiennes, les récompenses et les classements sont conservés.

## Démarrage sur Windows

1. Installer **Node.js 22.13 ou plus récent** : https://nodejs.org
2. Double-cliquer sur **`Lancer AnimeConnection.bat`**.
3. Accéder à **http://localhost:3000** (le navigateur est normalement ouvert automatiquement).

Ou depuis un terminal dans ce dossier :

```sh
npm start
```

Ne pas ouvrir directement `public/index.html` dans le navigateur : ce jeu nécessite son serveur pour les comptes, les tirages et les échanges.

La base de données des joueurs est dans `data/animeconnection.db`. Il faut conserver ce fichier, ainsi que ses éventuels fichiers `-wal` / `-shm` en cas de transfert entre machines.

## Catalogue

Les cartes sont générées depuis des données **AniList mises en cache** dans `tools/.cache/bulk/`. Le catalogue final est dans `data/cards.json`. Pour le reconstruire, avec les fichiers cachés fournis :

```sh
node tools/build-cards.mjs 50000
```

Le générateur garantit exactement 50 000 cartes, des identifiants uniques et les 320 références du premier set. Les cartes de personnages les plus populaires bénéficient des raretés les plus élevées ; les personnages phares peuvent exister en plusieurs versions de rareté.

**Images** : le catalogue contient les noms, raretés, séries, métadonnées et **liens d'illustrations de personnages AniList**. Les 50 000 images ne sont **pas téléchargées localement** dans l'archive : elles s'affichent depuis les URL externes et nécessitent Internet. Les images externes peuvent devenir indisponibles ; une initiale de remplacement apparaît alors. Vous pouvez placer vos propres illustrations dans `public/art/`, nommées par numéro de carte (`OP-001.webp`) ou ID de carte, pour les remplacer.

Les noms et illustrations appartiennent à leurs ayants droit. Pour un usage commercial, obtenir les licences appropriées.

## Animations

Les animations spéciales se déclenchent au **retournement** d'une carte Légendaire ou supérieure. La scène permet de **cliquer pour continuer** ou d'utiliser **Échap** pour passer. La préférence système « Réduire les animations » est prise en compte.

Les effets sont dans `public/js/opening.js` et `public/css/cards.css`. Les règles de rareté et de packs sont dans `lib/game.js`.

## Performance / architecture

- Node.js et SQLite : ouverture des packs et économie calculées côté serveur.
- `GET /api/static` : informations des séries et des taux, sans les 50 000 illustrations.
- `GET /api/catalog` : recherche, tri, filtres et pagination côté serveur.
- `POST /api/cards` : fiche des cartes demandées par lots.
- 48 cartes rendues par page dans le classeur ; les images utilisent le chargement différé.

Le projet de départ `Koma` est également conservé dans le dossier parent, mais **AnimeConnection** est le jeu complet avec comptes, packs et le catalogue 50 000 cartes.


## Équilibrage des packs (novembre 2026)

Les taux sont définis **côté serveur** dans `lib/game.js`. Standard / Série sont
les plus accessibles mais Légendaire+ est rare. Céleste, Royal et Édition spéciale
coûtent davantage et offrent des taux améliorés. Le pack Édition spéciale a
**10 % de chance par pack** de contenir une carte collector de l’édition choisie
(pas de garantie). Les Secrètes/Primordiales ont des poids infimes, y compris
dans les packs premium. La garantie de fidélité intervient au 120e pack sans
Légendaire+, garantit une **Légendaire exacte** et ne donne jamais une Secrète.

Le classeur affiche toutes les cartes, possédées ou non, dans l’ordre
**N° 00001 à N° 50000**. Choisir une série filtre instantanément les cartes
avec leur numérotation globale conservée. Vous pouvez chercher `DBZ` ou
`Dragon Ball Z` pour accéder à la série Dragon Ball Z.

### Visuels Summer Waifus

Les images AniList par défaut **ne représentent pas forcément** les héroïnes
en maillot de bain. Pour des illustrations fidèles à chaque personnage, placez
vos images personnalisées dans `public/art/`, sous le numéro de carte, par
exemple `SUM-005.webp` pour Nami. Elles remplacent automatiquement l’image
AniList. Vérifiez les droits d'utilisation de vos illustrations.

## V5 — Vérification des noms et des séries

Correction de 1 090 cartes ordinaires dans 212 séries et 4 métadonnées collector (dont Megumi / Food Wars, Tatsumaki / One Punch Man et Darkness / KonoSuba). Les 50 000 cartes et leurs identifiants sont conservés. Fichiers de contrôle dans `tools/audit/` : détail CSV, résumé JSON et corrections réappliquées en cas de reconstruction du catalogue. Il s'agit d'un **audit automatique**, pas d'une confirmation manuelle exhaustive de toutes les fiches.


## V6 — Pack Secret gratuit

Dans **Packs → Packs offerts**, un nouveau **Pack Secret gratuit** contient **5 cartes dont exactement une Secrète**. Les quatre autres sont tirées parmi Commune, Rare, Épique, Légendaire et Mythique. Le pack ne donne pas de Primordiale supplémentaire.

- **Une seule ouverture par compte**, anciens et nouveaux comptes inclus. Le bouton devient « Déjà récupéré » après utilisation.
- **0 Coin** à dépenser ; le tirage est calculé côté serveur et enregistré dans SQLite.
- L'ouverture déclenche la **cinématique Secrète** habituelle, et la carte rejoint la collection du joueur.
- Un nouveau champ `secret_gift_claimed` est créé automatiquement à l'installation ou lors du démarrage d'une ancienne base de joueurs. **Ne supprimez pas votre base de données pour mettre à jour !**
- Les chances très faibles des Secrètes dans les packs ordinaires, premium et éditions spéciales restent inchangées. Cette garantie est une exception pour le pack cadeau unique.


## V8 — Pack Test Ultime (mode démo)
Dans **Packs → Packs offerts**, le Pack Test Ultime est gratuit et réouvrable sans limite.
Il affiche exactement 5 cartes, une de chaque : Épique, Légendaire, Mythique, Secrète, Primordiale.
Chaque carte déclenche la cinématique de sa rareté. Aucun Coin, pack, carte, taux,
mission ou compteur de fidélité n'est modifié : ce sont des cartes de démonstration.
L'API `/api/packs/test` ne modifie pas les données du compte.
Après la fermeture, les révélations Secrète/Primordiale de démonstration
sont retirées du cache du navigateur si le joueur ne les possède pas.


## V10 — Reveal premium HD/4K pour Légendaire+

Les cartes **Légendaires, Mythiques, Secrètes et Primordiales** ont une séquence
cinématique dédiée avec décor Canvas vectoriel jusqu'à **3840 × 2160 pixels**,
portrait présenté sans étirement abusif, halos, anneaux, projections, transitions
de typographie, et palettes distinctes pour les quatre raretés. Les cartes en
dessous de Légendaire sont inchangées. Les écrans mobiles et les personnes ayant
activé « Réduire les animations » sont pris en charge.

**Important :** une scène calculée en 4K ne transforme pas les petites images
AniList en œuvres 4K. Les portraits d'origine gardent leur qualité native ; le
rendu est conçu pour éviter de les étirer sur toute la surface. Pour une vraie
illustration de personnage 4K ou une véritable **animation vidéo du personnage**,
ajouter vos fichiers dans `public/reveals/` et les référencer par l'identifiant
de carte dans `public/reveals/manifest.json`. Voir `README_REVEAL_4K.md`.

Le **Pack Test Ultime** (5 cartes, mode démo) est conservé pour comparer toutes
les nouvelles animations sans changer la collection ou les Coins.


## Packs Éditions spéciales — règles de tirage (novembre 2026)

- **League of Legends** : 5 cartes exclusivement issues de League of Legends.
- **Summer Waifus / Légendes du Shōnen / Les Grands Méchants** : les cartes Commune, Rare et Épique sont issues du catalogue normal ; toutes les cartes Légendaires, Mythiques, Secrètes, Primordiales et Astrales sont uniquement celles de l'édition sélectionnée.
- Les 10 % de bonus collector et la garantie de fidélité (Légendaire) conservent la même restriction ; ouvertures unitaires, multiples et de réserve identiques.
- Aucune modification des collections de joueurs et aucun rétroactif sur les anciens packs.
- Tests serveur : `node lib/test-special-edition-pools.cjs` (exécuté automatiquement au build Railway).
