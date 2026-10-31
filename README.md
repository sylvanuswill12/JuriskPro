# JuriskPro — application Web / PWA

Cette version impose une étape d'authentification Supabase avant l'accès à l'application : création de compte, connexion et réinitialisation du mot de passe. Les comptes peuvent nécessiter une confirmation par e-mail selon les réglages Auth du projet Supabase.

## Fichiers principaux
- `index.html` : page de démarrage (écran logo + slogan immédiat) et chargement des fichiers ci-dessous.
- `styles.css`, `core.js`, `app.js` : styles, outils communs (nombres en lettres, export Word/PDF) et application.
- `catalogue.js` : liste légère des modèles (titre, résumé, fichiers à charger). Affichée sans télécharger les modèles.
- `models/` : `m1.js`, `m2.js`, `m3.js`, `notaires.js` — chaque fichier n'est téléchargé que lorsqu'on ouvre un de ses modèles (ou qu'un brouillon existe).
- `vendor/` : JSZip, jsPDF et Supabase en local (généré par `npm install && npm run vendor`, à versionner pour Netlify). Sans ce dossier, le CDN sert de secours.
- `auth-gate.js` : contrôle d'accès par session Supabase.
- `supabase-config.js` : URL Supabase et clé publique à renseigner après création du projet.
- `supabase/schema.sql` : tables, RLS et stockage privé pour le catalogue, les documents et les brouillons.
- `manifest.webmanifest`, `sw.js`, `icons/` : PWA. `sw.js` met en cache les fichiers de l'application ; **changer `VERSION` dans `sw.js` à chaque publication**. Les données restent en ligne.

## Configuration obligatoire avant publication
1. Créer le projet Supabase `JuriskPro`.
2. Exécuter intégralement `supabase/schema.sql` dans SQL Editor.
3. Dans `supabase-config.js`, remplacer `https://VOTRE-PROJET.supabase.co` et `COLLER_ICI_LA_CLE_PUBLISHABLE_OU_ANON` par l'URL du projet et sa clé publique `anon` ou `publishable`.
4. Dans Supabase > Authentication > URL Configuration, définir l'URL du site publiée comme Site URL et ajouter les URL de redirection utilisées (URL Netlify et URL de prévisualisation si nécessaire).
5. Vérifier le paramètre de confirmation d'e-mail dans Authentication > Providers > Email.
6. Publier le projet mis à jour sur GitHub puis laisser Netlify déployer.

**Sécurité :** mettre uniquement la clé publique `anon`/`publishable` dans `supabase-config.js`. Ne jamais mettre la clé `service_role`/`secret` ou le mot de passe PostgreSQL dans le navigateur, GitHub ou Netlify.

## État fonctionnel et limites à ce stade
- L'écran de connexion obligatoire est intégré au démarrage et bloque l'application sans session authentifiée.
- La création de compte, la connexion, la session persistante et la demande de réinitialisation utilisent Supabase Auth après configuration des clés.
- Le schéma SQL prépare les tables sécurisées pour documents, brouillons, catalogue versionné et fichiers privés.
- **La synchronisation distante effective des brouillons et de l'historique, l'envoi des fichiers dans Storage et le chargement dynamique des modèles ne sont pas encore raccordés dans cette version.** Il faudra les intégrer et les tester après la création du projet Supabase avant de présenter ces fonctions comme disponibles.

## Déploiement Netlify depuis GitHub
- Branche : `main`
- Build command : vide
- Publish directory : `.`
- Base directory : vide


## Performance
- Le logo et le slogan sont dans le HTML et le CSS critique de `index.html` : ils s'affichent sans attendre le réseau (polices non bloquantes).
- JSZip et jsPDF ne se chargent qu'au premier clic sur Word / PDF / Partager ; Supabase se charge en arrière-plan pendant l'affichage du formulaire.
- L'écran de démarrage disparaît dès que l'application est prête (1,5 s minimum).

## Ajouter un modèle
1. Créer `models/mon-modele.js` : définir le modèle puis terminer par `JPModels.add(MonModele);` (outils disponibles : `P`, `L`, `ART`, `fcfa`, `lettres`, etc., voir `core.js`).
2. Ajouter sa fiche dans `MODELS` de `catalogue.js` (id, cat, titre, sous, resume, tags, duree, `files:['mon-modele']`). Si le modèle dépend d'un autre fichier, lister les deux dans `files`, dans l'ordre.
3. Augmenter `VERSION` dans `sw.js`.

## APK signé
Voir `SIGNATURE-APK.md`.
