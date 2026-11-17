# AnimeConnection V20 — Identités Astral / Primordiale / Secrète (BROUILLON)

La branche `draft/distinct-elite-art-and-cast-v20` ne doit **pas être fusionnée ni déployée** avant validation.

## Identités visuelles (sans modifier la mécanique des packs)

| Rareté | Univers graphique | Traitement |
| --- | --- | --- |
| **Astral** | cosmos violet/bleu, orbites, étoiles, figure centrale et nom vertical | modèle exclusif `astralHTML` déjà présent |
| **Primordiale** | relique ancestrale, dorures, gravures, halo solaire | nouveau masque doré et composition centrée |
| **Secrète** | prisme cybernétique, glyphes géométriques cyan/fuchsia | nouvelle composition angulaire, étiquette décalée |

Un **même personnage ne doit pas figurer deux fois** parmi ces trois raretés, que ce soit dans une même rareté ou entre plusieurs raretés. Un **portrait identique** ne doit pas non plus être utilisé pour deux cartes de ces niveaux. Les versions des personnages disponibles dans les raretés inférieures ne sont pas concernées.

## Fichiers modifiés en brouillon

- `public/js/cards.js` : couches spécifiques Secrète et Primordiale.
- `public/css/elite-identities.css` : règles séparées, avec animation réduite si nécessaire.
- `public/index.html` : import de la nouvelle feuille de style.
- `tools/audit-elite-characters.mjs` : audit des noms/personnages et portraits, avec alternatives candidates.
- `package.json` : commande `npm run cards:audit-elite`.

## Validation du catalogue

Le fichier `data/cards.json` **n'est pas présent dans le dépôt** au moment de la préparation. Les différences visuelles sont codées, mais **la liste des personnages réellement uniques ne peut pas être certifiée** sans ce fichier.

Une fois le catalogue complet récupéré :

1. Exécuter `npm run cards:audit-elite`.
2. Corriger tous les personnages et images en doublon répertoriés ; le script fournit des suggestions dans les séries concernées et retourne un code d'erreur quand il reste des collisions.
3. Conserver les identifiants de cartes et la base de joueurs, revoir les modifications de personnages déjà possédés avant de publier.
4. Tester les trois types de cartes dans le Pack Test Ultime et dans le classeur, en version PC et mobile.
5. Préparer des illustrations adaptées à chaque personnage en `public/art/<numéro>.webp` pour éviter les portraits AniList répétés / basse résolution.

**Important** : aucune carte ne doit être masquée dans le catalogue, y compris non obtenue. Les thèmes graphiques ne doivent pas masquer les personnages, le nom ni le numéro de collection.
