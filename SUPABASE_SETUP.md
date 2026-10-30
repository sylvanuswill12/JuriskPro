# Préparation Supabase — JuriskPro évolutif

## Objectif
Supabase ne doit pas être limité aux sept modèles actuellement présents dans l'application. Le catalogue est conçu pour accueillir de nouveaux modèles et catégories sans recréer la base à chaque ajout.

## À faire lors de la création du projet
1. Créer un projet Supabase nommé `JuriskPro` et choisir ensemble la région.
2. Définir un mot de passe PostgreSQL robuste et le conserver en lieu sûr. Ne pas le mettre dans GitHub ni dans le code HTML.
3. Ouvrir **SQL Editor > New query**, copier `supabase/schema.sql` et exécuter le script complet.
4. Dans **Project Settings > API** (ou Connect), récupérer l'URL du projet et la clé publique `anon` / `publishable`.
5. Ne jamais placer la clé `service_role` / `secret` dans le navigateur, Netlify ou GitHub.
6. Configurer l'URL du site `https://juriskpro.netlify.app` et les redirections d'authentification autorisées, dont `https://juriskpro.netlify.app/**`.

## Tables créées
- `juriskpro_templates` : catalogue de modèles, catégories, description et statut.
- `juriskpro_template_versions` : versions indépendantes de chaque modèle, schémas de formulaires JSONB, modèle de document et règles de validation.
- `juriskpro_documents` : historique des documents rédigés, avec instantané du modèle/version utilisé. Un ancien document reste ainsi intelligible même si le modèle évolue.
- `juriskpro_drafts` : plusieurs brouillons par utilisateur, y compris plusieurs brouillons fondés sur le même modèle.
- `juriskpro_user_roles` : rôles d'administration attribués uniquement par le propriétaire du projet.
- Bucket privé `juriskpro-documents` : exports PDF/DOCX, chaque fichier rangé dans le dossier UUID de son propriétaire.

## Ajouter un modèle plus tard
1. L'administrateur crée une fiche dans `juriskpro_templates` avec un `slug` unique, un titre et une catégorie.
2. Il crée une version dans `juriskpro_template_versions` : `form_schema` décrit les champs, `validation_rules` les contrôles, et `document_template` la structure du document.
3. Après tests, il publie la version et la fiche du modèle (`status = 'published'`).
4. L'application chargera le catalogue publié depuis Supabase. Les documents enregistreront le modèle et sa version, plus un instantané des paramètres utiles.

Le schéma prépare cette gestion évolutive. L'interface d'administration et le moteur générique de formulaires doivent encore être développés et raccordés avant qu'un administrateur puisse ajouter un modèle uniquement depuis l'application.

## État fonctionnel actuel
La rubrique Historique préparée enregistre encore localement les exports sur l'appareil courant. Le SQL prépare la sauvegarde distante et le catalogue évolutif ; l'authentification Supabase, le moteur de catalogue dynamique et la synchronisation effective restent à intégrer et à tester. Ne pas annoncer la synchronisation multi-appareils avant ces tests.
