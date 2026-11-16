# AnimeConnection V18 — Astral fusion & pack opening ×2–×10

## Cartes Astral
- Le **cadre cosmique V17** est conservé, avec une surcouche transparente `public/art/astral-frame-overlay.webp` pour placer les ornements devant le personnage.
- Portrait du personnage agrandi et **fondu dans la scène** par masque doux, arrière-plan coloré et effets holographiques.
- Nom vertical adapté automatiquement aux noms plus longs, pied de carte lisible.
- Les portraits des personnages restent les références d'origine (AniList ou illustrations locales). **L'interface ne peut pas créer de véritables images 4K à partir de petits portraits AniList** : les images sources de faible résolution ne deviennent pas nettes en les agrandissant.

## Ouvrir plusieurs boosters
- Bouton **Ouvrir tout ×N** lorsque 2–10 packs gratuits sont disponibles (ex. 4 accumulés → 4 packs, 20 cartes).
- Packs de réserve : ouverture groupée jusqu'à 10 par opération ; le bouton indique le nombre.
- **Animation de pack opening** : chaque booster apparaît, se déchire, les cinq cartes sortent face cachée puis se retournent. Le récapitulatif suit, avec possibilité de revoir les reveals des cartes Légendaires et plus.
- Bouton pour accélérer et afficher directement les cartes.
- Les tirages sont toujours effectués par le serveur dans **une transaction unique**, sans modifier les taux de rareté.

## Interface
- Boutons premium violet / or, états de survol et focus clavier améliorés.
- Icônes de boosters modernisées, icône `layers` désormais réellement présente, nouvelle icône d'impact pour l'ouverture en lot.

## Installation et sauvegarde
1. Décompressez l'archive puis lancez `LANCER LE SITE.bat`.
2. Pour mettre à jour une installation précédente, **conservez votre fichier `animeconnection/data/animeconnection.db`** : il contient comptes, Coins et collections.
3. Le ZIP n'inclut **aucune base de comptes de test**.

## Tests
- Contrôles de syntaxe : `server.js`, `lib/game.js`, tous les modules JS du site.
- Tests serveur : ouverture de 5 packs de réserve (25 cartes), ouverture de 4 packs gratuits accumulés (20 cartes), refus si stock insuffisant.
- Vérification isolée du rendu de la carte Astral et des animations CSS d'ouverture groupée via Chromium.
- Le parcours complet du site dans un navigateur pointant sur le serveur local n'a pas été exécuté : accès à localhost bloqué par la politique de navigation de l'environnement.
