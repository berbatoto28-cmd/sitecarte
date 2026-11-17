# Classement par anime : Légendaire à Astral

Le classeur regroupe chaque anime, puis affiche ses cartes par rareté décroissante : Astral, Primordiale, Secrète, Mythique, Légendaire, Épique, Rare, Commune. À rareté égale, les favoris enregistrés déterminent l’ordre. Les pages d’une série suivent ce même ordre. Les numéros de collection restent inchangés.

Les personnages disponibles les plus appréciés occupent les raretés les plus élevées, selon les favoris AniList (fav) enregistrés dans le catalogue. Ce classement n’est pas en temps réel. Les personnages partagés sont attribués en priorité aux séries ordinaires les plus populaires. Hors éditions spéciales autres que LoL, un même personnage ou portrait ne peut apparaître qu’une fois au total parmi Légendaire, Mythique, Secrète, Primordiale et Astral.

Les variantes non retenues sont reclassées en Épique. Itachi a une seule carte entre Légendaire et Astral (son Astral), ses deux autres cartes restent en Épique. Les séries sans suffisamment de personnages distincts ont moins de cartes dans les niveaux supérieurs.

Les identifiants, numéros, noms, illustrations et quantités des joueurs sont conservés. Les valeurs et scores suivent les nouvelles raretés ; les probabilités par rareté des packs restent inchangées. Aucun fichier de base de données n’est déployé sur le volume Railway /data.

Reproduction : node tools/rank-elite.cjs <source.json> data/cards.json [rapport.json].
Les éditions Summer Waifus, Légendes du Shōnen et Les Grands Méchants sont exemptées du contrôle des doublons. Leurs 103 cartes retrouvent leurs données et visuels V20 d’origine, toutes au minimum Légendaires. Le classement ordinaire ne les modifie plus. Les styles Secrète et Primordiale ordinaires ne remplacent pas leur ancien habillage. LoL conserve ses raretés et son apparence précédentes.
Vérifications : node tools/test-elite.cjs ; node test-v20.cjs ; node test-render.cjs ; node tools/test-missions-bulk.cjs.
