# JuriskPro — préparation APK Android

Ce dossier est un **complément à ajouter à la racine du dépôt GitHub existant**. Il ne remplace aucun fichier juridique ou Supabase.

## Ce que fait le workflow

À chaque push pertinent sur `main`, ou à la demande via GitHub Actions, le workflow :
1. installe Capacitor ;
2. copie `index.html`, `auth-gate.js`, `supabase-config.js` et les ressources web existantes dans `www/` ;
3. génère le projet Android ;
4. compile un APK **debug** ;
5. publie l'APK comme artefact téléchargeable pendant 30 jours.

## Conditions importantes

- Conserver à la racine du dépôt les fichiers actuels `index.html`, `auth-gate.js` et `supabase-config.js`.
- `supabase-config.js` doit contenir uniquement l'URL du projet et la clé publique/publishable Supabase. Ne jamais mettre une clé `service_role` ou `secret` dans l'application ou GitHub.
- Le premier APK est un APK de test (debug), pas encore l'APK de distribution signé.
- Vérifier dans Supabase Authentication > URL Configuration que les URL de redirection de confirmation et de réinitialisation de mot de passe couvrent le flux Android retenu. Les liens de confirmation doivent être testés sur un vrai appareil.
- Les bibliothèques JSZip, jsPDF et Supabase JS sont actuellement chargées depuis des CDN dans `index.html` : elles nécessitent une connexion Internet. Prévoir leur intégration locale avant de promettre un fonctionnement hors ligne.
- Le workflow génère le projet Android à chaque exécution ; le dossier `android/` n'a donc pas besoin d'être ajouté au dépôt à cette étape.

## Lancer

GitHub > dépôt JuriskPro > Actions > Build JuriskPro Android APK > Run workflow.
Après réussite : ouvrir l'exécution, section Artifacts, télécharger `JuriskPro-debug-APK`, puis extraire `app-debug.apk`.

## Avant distribution sur le site

Il faudra configurer une signature de release protégée (keystore + secrets GitHub), tester l'installation/mise à jour, l'authentification, les liens e-mail, l'export Word/PDF, l'historique Supabase, les téléchargements et le comportement sur plusieurs tailles d'écran. Ne jamais publier le debug APK comme version finale.
