# Astral / Primordiale / Secrète — classement par anime

Le classement utilise les favoris AniList (`fav`) déjà enregistrés dans le catalogue. Il ne représente pas un sondage en temps réel. Pour chaque anime : premier personnage disponible en Astral, suivant en Primordiale, puis jusqu'à trois personnages en Secrète.

Un personnage (identifié par son identifiant AniList dans le portrait, ou par son identifiant Riot) ne peut apparaître qu'une fois dans l'ensemble de ces trois raretés. Les portraits et illustrations sont également uniques. Les homonymes de personnages différents ne sont pas des doublons. Les éditions et les séries partageant des personnages choisissent parmi les personnages encore disponibles ; les séries ordinaires les plus populaires sont prioritaires.

Les 58 949 cartes du catalogue source conservent leur ordre, identifiant, numéro, nom et illustration. L'édition LoL actuelle reste injectée par `lib/lol-data.js`, soit 59 126 cartes au total. Les comptes, sessions, quantités possédées et la base SQLite ne sont pas remplacés. La rareté de cartes existantes change, donc leur valeur et leur score suivent les règles habituelles de leur nouvelle rareté.

Catalogue source corrigé : 2 569 Astral, 2 571 Primordiales, 7 711 Secrètes. LoL ajoute ses quatre Astral distinctes. Six emplacements non attribuables sans répétition sont reclassés en Mythique (Komori-san, Genshin et Légendes du Shōnen) ; les cartes restent accessibles.

Le Dockerfile extrait les ressources originales puis superpose uniquement le catalogue statique `data/cards.json`. Le volume Railway `/data` et le chemin de la base des joueurs restent inchangés.

Vérifications : `node tools/test-elite.cjs`, `node test-render.cjs`, `node test-v20.cjs`. Reproduction : `node tools/rank-elite.cjs <catalogue-original.json> <catalogue-corrige.json> [rapport.json]`.
