# Classement par anime : Légendaire à Astral

Le classeur regroupe chaque anime, puis affiche ses cartes par rareté décroissante : Astral, Primordiale, Secrète, Mythique, Légendaire, Épique, Rare, Commune. À rareté égale, les favoris enregistrés déterminent l’ordre. Les pages d’une série suivent ce même ordre. Les numéros de collection restent inchangés.

Les personnages disponibles les plus appréciés occupent les raretés les plus élevées, selon les favoris AniList (fav) enregistrés dans le catalogue. Ce classement n’est pas en temps réel. Les personnages partagés sont attribués en priorité aux séries ordinaires les plus populaires. Un même personnage ou portrait ne peut apparaître qu’une fois au total parmi Légendaire, Mythique, Secrète, Primordiale et Astral.

Les variantes non retenues sont reclassées en Épique. Itachi a une seule carte entre Légendaire et Astral (son Astral), ses deux autres cartes restent en Épique. Les séries sans suffisamment de personnages distincts ont moins de cartes dans les niveaux supérieurs.

Les identifiants, numéros, noms, illustrations et quantités des joueurs sont conservés. Les valeurs et scores suivent les nouvelles raretés ; les probabilités par rareté des packs restent inchangées. Aucun fichier de base de données n’est déployé sur le volume Railway /data.

Reproduction : node tools/rank-elite.cjs <source.json> data/cards.json [rapport.json].
Vérifications : node tools/test-elite.cjs ; node test-v20.cjs ; node test-render.cjs ; node tools/test-missions-bulk.cjs.
