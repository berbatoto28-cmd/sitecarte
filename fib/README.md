# FIB — Portail officiel

Site vitrine public avec espace membre privé et mini MDT.

## Rubriques publiques
Accueil, Le Bureau, Recrutement, Communiqués, Contact.

## Espaces privés
Tableau de bord, Dossiers (import PDF/JPG/PNG/DOCX ≤ 8 Mo), Divisions, Formations, Documentation et Administration.

## Comptes et droits
Les comptes sont créés par un administrateur. La connexion utilise un identifiant et un mot de passe haché avec bcrypt. Les sessions utilisent un cookie HttpOnly sécurisé en HTTPS et un stockage PostgreSQL. Les partages vers LSPD, EMS et Gouvernement ne donnent accès qu'aux dossiers explicitement partagés.

## Variables d'environnement obligatoires
- `DATABASE_URL`: URL PostgreSQL, à référencer depuis Railway Postgres.
- `SESSION_SECRET`: valeur aléatoire de 32 caractères minimum.
- `SETUP_TOKEN`: code secret unique pour la création du premier administrateur.
- `NODE_ENV=production`

## Première utilisation
1. Ouvrir `/initialisation` avec le `SETUP_TOKEN` défini dans Railway.
2. Créer l'identifiant et le mot de passe administrateur (12 caractères minimum).
3. Se connecter à `/connexion`.
4. Créer les comptes des membres et partenaires dans Administration.
5. Ajouter les divisions et les communiqués.

L'initialisation est automatiquement désactivée après création du premier compte.

## Hébergement
Dans Railway : service app depuis la branche `fib-portal`, répertoire racine `/fib`, Dockerfile `Dockerfile`, Postgres dans le même projet. Exposer un domaine HTTPS sur le port Railway `PORT` (ou 3000 localement). Tester `/healthz` puis l'initialisation.

## Sécurité et limites
Les fichiers sont stockés en base PostgreSQL et servis uniquement après vérification des droits. Les images JPG et PNG sont affichées directement en miniature dans Mini MDT et Documentation, avec ouverture en grand sans téléchargement ; le téléchargement reste disponible séparément. Les autres formats conservent leur lien de téléchargement. Prévoir des sauvegardes régulières, un anti-virus pour les fichiers entrants, des tests de pénétration et une revue de sécurité avant utilisation avec de vraies données personnelles ou des informations confidentielles. Ce prototype ne comporte pas encore de récupération de mot de passe, de MFA ni d'édition/suppression de dossiers.
