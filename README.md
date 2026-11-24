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
