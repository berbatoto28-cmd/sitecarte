# Dreamlight · Centre des règlements

Site en français avec quatre pages de règlement. Les textes fournis sont des exemples.

## Modifier les règlements

Éditer `reglements.json`. Chaque rubrique contient son titre, sa description, son adresse (`slug`) et les sections de son règlement. Une nouvelle rubrique apparaît automatiquement sur l’accueil et dans la navigation.

Une fois les textes officiels intégrés, retirer les deux mentions de texte provisoire dans `server.js`.

## Lancer en local

Avec Node.js 22 ou supérieur, lancer `npm start`, puis ouvrir http://localhost:3000.

## Déployer sur Railway

Connecter le dépôt GitHub à un service Railway. Le fichier `railway.json` configure le démarrage et le contrôle de santé. Dans les réglages réseau du service, générer un domaine public Railway. Les changements envoyés sur la branche connectée déclenchent les nouveaux déploiements.
