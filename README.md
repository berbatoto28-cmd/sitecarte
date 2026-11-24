# Dreamlight · Centre des règlements

Site en français avec un règlement général, un règlement en jeu, un règlement illégal et un règlement légal organisé en seize rubriques. Les textes fournis sont des exemples.

## Modifier les règlements

Éditer `reglements.json`. Chaque rubrique contient son titre, sa description, son adresse (`slug`) et les sections de son règlement. Une nouvelle rubrique apparaît automatiquement sur l’accueil et dans la navigation.

Pour le règlement légal, les seize sous-catégories sont dans `rubriques` sous l’entrée `legal`. Remplir `sections` avec les titres et textes officiels de chaque sous-catégorie. Le texte complet de la rubrique Général se trouve dans son champ `reglement`.

Une fois les textes officiels intégrés, retirer les deux mentions de texte provisoire dans `server.js`.

## Lancer en local

Avec Node.js 22 ou supérieur, lancer `npm start`, puis ouvrir http://localhost:3000.

## Déployer sur Railway

Connecter le dépôt GitHub à un service Railway. Le fichier `railway.json` configure le démarrage et le contrôle de santé. Dans les réglages réseau du service, générer un domaine public Railway. Les changements envoyés sur la branche connectée déclenchent les nouveaux déploiements.

## Changer le fond

Ajouter une image WebP nommée `dreamlight-background.webp` à la racine du dépôt et l’envoyer sur la branche déployée. Le site l’utilise automatiquement derrière un voile sombre. Sans ce fichier, le fond nocturne intégré s’affiche.

## Portail et boutique

Sur Railway, renseigner la variable `DREAMLIGHT_DISCORD_URL` avec le lien HTTPS officiel pour afficher le bouton Discord.

Ajouter les offres dans `boutique.json` avec les champs `nom`, `description`, `prix` et `lien`. Le lien HTTPS ouvre la page d’achat du prestataire choisi. Une offre sans lien valide apparaît comme indisponible.
