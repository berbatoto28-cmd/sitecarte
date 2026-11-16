# AnimeConnection — Personnages animés & visuels 4K

Le reveal V10 est inclus pour **toutes les cartes Légendaires ou plus**,
y compris dans le Pack Test Ultime. L'arrière-plan, les particules et les effets
sont rendus dans la résolution de l'écran (jusqu'à 3840 × 2160).

## Pour les vraies animations de personnages

Le projet ne contient pas 50 000 vidéos de personnages. Le reveal utilise
l'illustration de la carte, limitée en taille pour éviter d'amplifier son flou.
Pour remplacer une illustration par un vrai visuel Full HD/4K ou une animation
WebM/MP4/GIF sur une carte précise :

1. Placer vos fichiers sous `public/reveals/` (ex. `videos/mon-id.webm` et
   `posters/mon-id.webp`). Les vidéos sont lues muettes et en boucle pendant
   le reveal de la carte.
2. Modifier `public/reveals/manifest.json` :

```json
{
  "cards": {
    "identifiant-exact-de-carte": {
      "poster": "/reveals/posters/mon-id.webp",
      "video": "/reveals/videos/mon-id.webm"
    }
  }
}
```

3. Redémarrer/rafraîchir la page du site. Le poster est utilisé si la vidéo
   échoue ou ne peut pas démarrer.

Pour les posters, viser 2160 px de hauteur ou davantage si le cadrage le permet.
Pour les vidéos, préférer WebM VP9/AV1 ou MP4 H.264 selon la compatibilité. Les animations sont facultatives : le reveal
reste opérationnel sans aucun fichier vidéo.

L'identifiant est l'attribut `id` dans `data/cards.json`, PAS le numéro
`SUM-001`, `OP-001`, etc.

## Accessibilité et performance

- Maximum 4K pour le canevas d'effets, même sur écrans à fort DPI ; FPS régulés.
- Clic sur **Voir la carte** ou Échap : transition immédiate.
- Bouton **Rejouer** pour revoir une animation pendant la découverte.
- « Réduire les animations » : reveal statique et passage rapide.
- Sur mobile, composition verticale adaptée.
- Aucune modification des probabilités ou du contenu du catalogue.
