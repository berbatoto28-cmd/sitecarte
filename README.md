# AnimeConnection V20 — déploiement Railway

Ce dépôt héberge AnimeConnection V20 pour Railway. L'application Node.js, son catalogue et ses illustrations sont inclus dans une archive de déploiement en plusieurs morceaux sous `payload/` ; le `Dockerfile` les extrait à la construction.

**Données des joueurs :** la base SQLite reste exclusivement sur le volume Railway monté sur `/data`. Ne jamais ajouter de fichier `animeconnection.db` à ce dépôt.

Déploiement via le service existant `pleasant-magic / daring-determination`.
