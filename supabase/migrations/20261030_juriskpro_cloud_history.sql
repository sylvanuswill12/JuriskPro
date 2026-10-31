-- JuriskPro: historique documentaire durable, privé et rattaché au compte.
-- À exécuter dans Supabase SQL Editor AVANT le déploiement du nouveau front.
create table if not exists public.juriskpro_documents (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  model_id text,
  model_title text,
  format text not null check (format in ('docx','pdf')),
  file_name text not null,
  storage_path text not null unique,
  document_text text,
  values_json jsonb,
  created_at timestamptz not null default now()
);

alter table public.juriskpro_documents add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.juriskpro_documents add column if not exists title text;
alter table public.juriskpro_documents add column if not exists model_id text;
alter table public.juriskpro_documents add column if not exists model_title text;
alter table public.juriskpro_documents add column if not exists format text;
alter table public.juriskpro_documents add column if not exists file_name text;
alter table public.juriskpro_documents add column if not exists storage_path text;
alter table public.juriskpro_documents add column if not exists document_text text;
alter table public.juriskpro_documents add column if not exists values_json jsonb;
alter table public.juriskpro_documents add column if not exists created_at timestamptz not null default now();
create index if not exists juriskpro_documents_user_created_idx on public.juriskpro_documents(user_id, created_at desc);
create unique index if not exists juriskpro_documents_storage_path_uidx on public.juriskpro_documents(storage_path) where storage_path is not null;
alter table public.juriskpro_documents enable row level security;
drop policy if exists "Users can read own JuriskPro documents" on public.juriskpro_documents;
drop policy if exists "Users can insert own JuriskPro documents" on public.juriskpro_documents;
drop policy if exists "Users can update own JuriskPro documents" on public.juriskpro_documents;
drop policy if exists "Users can delete own JuriskPro documents" on public.juriskpro_documents;
create policy "Users can read own JuriskPro documents" on public.juriskpro_documents for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own JuriskPro documents" on public.juriskpro_documents for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own JuriskPro documents" on public.juriskpro_documents for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own JuriskPro documents" on public.juriskpro_documents for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('juriskpro-documents','juriskpro-documents',false,20971520, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public=false, file_size_limit=20971520;
drop policy if exists "Users can read own JuriskPro document files" on storage.objects;
drop policy if exists "Users can upload own JuriskPro document files" on storage.objects;
drop policy if exists "Users can delete own JuriskPro document files" on storage.objects;
create policy "Users can read own JuriskPro document files" on storage.objects for select to authenticated using (bucket_id='juriskpro-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Users can upload own JuriskPro document files" on storage.objects for insert to authenticated with check (bucket_id='juriskpro-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Users can delete own JuriskPro document files" on storage.objects for delete to authenticated using (bucket_id='juriskpro-documents' and (storage.foldername(name))[1]=auth.uid()::text);
