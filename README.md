# JuriskPro — préparation Web / PWA

Cette préparation conserve le code applicatif existant dans `index.html` et ajoute le socle de publication.

## Contenu
- `index.html` : application actuelle, sans réécriture de ses modèles et de ses exports.
- `manifest.webmanifest` : identité installable de JuriskPro.
- `sw.js` : service worker réseau uniquement. L'application nécessite Internet et ne met aucun document en cache hors connexion.
- `icons/` : icônes dérivées du logo déjà intégré à l'application.

## Publication Netlify depuis GitHub
1. Créer un dépôt GitHub privé nommé `JuriskPro`.
2. Déposer le contenu de ce dossier à la racine du dépôt.
3. Dans Netlify, importer le dépôt GitHub.
4. Laisser le répertoire de publication à la racine (`.`) et ne définir aucune commande de build.
5. Publier via HTTPS.

## Étape suivante
Brancher Supabase Auth, la base de données et Storage après création du projet Supabase. Les clés publiques nécessaires seront configurées dans Netlify. La clé `service_role` ne doit jamais être intégrée au navigateur ou au dépôt GitHub.

## État
Socle de publication préparé ; intégration Supabase, tests fonctionnels, tests mobiles et validation PWA restent à effectuer.
