-- JuriskPro / Supabase — schéma évolutif
-- À exécuter dans Supabase > SQL Editor après création du projet.
-- Les utilisateurs ne voient que leurs propres documents et brouillons.
-- Les modèles sont gérés séparément du code : le catalogue peut grandir sans
-- recréer les tables. Les versions publiées restent référencées par l'historique.

create extension if not exists pgcrypto;

-- Rôles internes. L'attribution du rôle admin se fait par SQL par le propriétaire
-- du projet Supabase ; aucun utilisateur ne peut s'attribuer ce rôle lui-même.
create table if not exists public.juriskpro_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.juriskpro_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.juriskpro_user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Catalogue extensible : un enregistrement par modèle logique.
create table if not exists public.juriskpro_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  current_version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists juriskpro_templates_status_category_idx
  on public.juriskpro_templates(status, category, title);

-- Définition versionnée du formulaire et du modèle de document.
-- form_schema et document_template sont des JSONB afin d'accueillir
-- des champs/règles différents pour chaque futur modèle.
create table if not exists public.juriskpro_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.juriskpro_templates(id) on delete cascade,
  version integer not null,
  form_schema jsonb not null default '{"fields":[]}'::jsonb,
  document_template jsonb not null default '{}'::jsonb,
  validation_rules jsonb not null default '{}'::jsonb,
  change_note text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(template_id, version)
);
create index if not exists juriskpro_template_versions_template_idx
  on public.juriskpro_template_versions(template_id, version desc);

-- Historique des documents créés par les utilisateurs.
create table if not exists public.juriskpro_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id text not null,
  model_title text not null,
  title text not null,
  content_text text not null default '',
  form_data jsonb not null default '{}'::jsonb,
  file_path text,
  file_format text check (file_format in ('docx','pdf') or file_format is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  template_id uuid references public.juriskpro_templates(id) on delete set null,
  template_version_id uuid references public.juriskpro_template_versions(id) on delete set null,
  template_version integer,
  template_snapshot jsonb not null default '{}'::jsonb,
  category text not null default 'Non classé'
);

-- Compatibilité si la table documents existait déjà avec le premier schéma.
alter table public.juriskpro_documents add column if not exists template_id uuid references public.juriskpro_templates(id) on delete set null;
alter table public.juriskpro_documents add column if not exists template_version_id uuid references public.juriskpro_template_versions(id) on delete set null;
alter table public.juriskpro_documents add column if not exists template_version integer;
alter table public.juriskpro_documents add column if not exists template_snapshot jsonb not null default '{}'::jsonb;
alter table public.juriskpro_documents add column if not exists category text not null default 'Non classé';
create index if not exists juriskpro_documents_user_created_idx
  on public.juriskpro_documents(user_id, created_at desc);
create index if not exists juriskpro_documents_template_idx
  on public.juriskpro_documents(template_id, template_version);

-- Brouillons : plusieurs brouillons peuvent utiliser le même modèle.
create table if not exists public.juriskpro_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id text not null,
  payload jsonb not null default '{}'::jsonb,
  current_step integer not null default 0,
  updated_at timestamptz not null default now(),
  template_id uuid references public.juriskpro_templates(id) on delete set null,
  template_version integer,
  title text not null default 'Brouillon'
);
alter table public.juriskpro_drafts add column if not exists template_id uuid references public.juriskpro_templates(id) on delete set null;
alter table public.juriskpro_drafts add column if not exists template_version integer;
alter table public.juriskpro_drafts add column if not exists title text not null default 'Brouillon';
-- L'ancien schéma imposait un seul brouillon par utilisateur/modèle ; on retire
-- cette contrainte pour autoriser plusieurs dossiers et brouillons par modèle.
alter table public.juriskpro_drafts drop constraint if exists juriskpro_drafts_user_id_model_id_key;
create index if not exists juriskpro_drafts_user_updated_idx
  on public.juriskpro_drafts(user_id, updated_at desc);

-- RLS : catalogue visible aux utilisateurs connectés uniquement lorsqu'un
-- modèle est publié ; gestion réservée aux administrateurs.
alter table public.juriskpro_user_roles enable row level security;
alter table public.juriskpro_templates enable row level security;
alter table public.juriskpro_template_versions enable row level security;
alter table public.juriskpro_documents enable row level security;
alter table public.juriskpro_drafts enable row level security;

drop policy if exists "Users can read own JuriskPro role" on public.juriskpro_user_roles;
create policy "Users can read own JuriskPro role" on public.juriskpro_user_roles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Read published templates or admin all" on public.juriskpro_templates;
create policy "Read published templates or admin all" on public.juriskpro_templates
  for select to authenticated using (status = 'published' or public.juriskpro_is_admin());
drop policy if exists "Admins insert templates" on public.juriskpro_templates;
create policy "Admins insert templates" on public.juriskpro_templates
  for insert to authenticated with check (public.juriskpro_is_admin());
drop policy if exists "Admins update templates" on public.juriskpro_templates;
create policy "Admins update templates" on public.juriskpro_templates
  for update to authenticated using (public.juriskpro_is_admin()) with check (public.juriskpro_is_admin());
drop policy if exists "Admins delete templates" on public.juriskpro_templates;
create policy "Admins delete templates" on public.juriskpro_templates
  for delete to authenticated using (public.juriskpro_is_admin());

drop policy if exists "Read published template versions or admin all" on public.juriskpro_template_versions;
create policy "Read published template versions or admin all" on public.juriskpro_template_versions
  for select to authenticated using (
    status = 'published' or public.juriskpro_is_admin()
  );
drop policy if exists "Admins insert template versions" on public.juriskpro_template_versions;
create policy "Admins insert template versions" on public.juriskpro_template_versions
  for insert to authenticated with check (public.juriskpro_is_admin());
drop policy if exists "Admins update template versions" on public.juriskpro_template_versions;
create policy "Admins update template versions" on public.juriskpro_template_versions
  for update to authenticated using (public.juriskpro_is_admin()) with check (public.juriskpro_is_admin());
drop policy if exists "Admins delete template versions" on public.juriskpro_template_versions;
create policy "Admins delete template versions" on public.juriskpro_template_versions
  for delete to authenticated using (public.juriskpro_is_admin());

-- Documents et brouillons : chaque compte est isolé.
drop policy if exists "Users can read their JuriskPro documents" on public.juriskpro_documents;
create policy "Users can read their JuriskPro documents" on public.juriskpro_documents for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their JuriskPro documents" on public.juriskpro_documents;
create policy "Users can create their JuriskPro documents" on public.juriskpro_documents for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their JuriskPro documents" on public.juriskpro_documents;
create policy "Users can update their JuriskPro documents" on public.juriskpro_documents for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their JuriskPro documents" on public.juriskpro_documents;
create policy "Users can delete their JuriskPro documents" on public.juriskpro_documents for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read their JuriskPro drafts" on public.juriskpro_drafts;
create policy "Users can read their JuriskPro drafts" on public.juriskpro_drafts for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their JuriskPro drafts" on public.juriskpro_drafts;
create policy "Users can create their JuriskPro drafts" on public.juriskpro_drafts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their JuriskPro drafts" on public.juriskpro_drafts;
create policy "Users can update their JuriskPro drafts" on public.juriskpro_drafts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their JuriskPro drafts" on public.juriskpro_drafts;
create policy "Users can delete their JuriskPro drafts" on public.juriskpro_drafts for delete to authenticated using (auth.uid() = user_id);

-- Stockage privé des exports PDF/DOCX : chemin obligatoire sous l'UUID utilisateur.
insert into storage.buckets (id, name, public)
values ('juriskpro-documents', 'juriskpro-documents', false)
on conflict (id) do nothing;
drop policy if exists "Users can read their JuriskPro files" on storage.objects;
create policy "Users can read their JuriskPro files" on storage.objects for select to authenticated
  using (bucket_id = 'juriskpro-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can upload their JuriskPro files" on storage.objects;
create policy "Users can upload their JuriskPro files" on storage.objects for insert to authenticated
  with check (bucket_id = 'juriskpro-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can update their JuriskPro files" on storage.objects;
create policy "Users can update their JuriskPro files" on storage.objects for update to authenticated
  using (bucket_id = 'juriskpro-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'juriskpro-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can delete their JuriskPro files" on storage.objects;
create policy "Users can delete their JuriskPro files" on storage.objects for delete to authenticated
  using (bucket_id = 'juriskpro-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Après avoir créé ton compte dans l'application, le propriétaire du projet
-- peut lui attribuer le rôle admin depuis le SQL Editor :
-- insert into public.juriskpro_user_roles(user_id, role)
-- select id, 'admin' from auth.users where email = 'TON_EMAIL';
