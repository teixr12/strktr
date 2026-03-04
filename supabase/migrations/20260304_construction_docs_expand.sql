-- STRKTR Construction Docs V1
-- Stage: expand
-- Non-breaking, additive only.

create table if not exists public.construction_docs_project_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  project_id uuid not null references public.projetos(id) on delete cascade,
  obra_id uuid null references public.obras(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, project_id)
);

create index if not exists idx_construction_docs_project_links_org_project
  on public.construction_docs_project_links (org_id, project_id);

create table if not exists public.construction_docs_visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  project_link_id uuid not null references public.construction_docs_project_links(id) on delete cascade,
  type text not null default 'PRE',
  visit_date date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint construction_docs_visits_type_chk check (type in ('PRE', 'POST'))
);

create index if not exists idx_construction_docs_visits_org_link_date
  on public.construction_docs_visits (org_id, project_link_id, visit_date desc);

create table if not exists public.construction_docs_rooms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  visit_id uuid not null references public.construction_docs_visits(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (visit_id, name)
);

create index if not exists idx_construction_docs_rooms_org_visit
  on public.construction_docs_rooms (org_id, visit_id, sort_order);

create table if not exists public.construction_docs_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  visit_id uuid not null references public.construction_docs_visits(id) on delete cascade,
  room_id uuid null references public.construction_docs_rooms(id) on delete set null,
  storage_key text not null,
  url text not null,
  thumbnail_key text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, storage_key)
);

create index if not exists idx_construction_docs_photos_org_visit
  on public.construction_docs_photos (org_id, visit_id, created_at desc);

create index if not exists idx_construction_docs_photos_org_room
  on public.construction_docs_photos (org_id, room_id);

create table if not exists public.construction_docs_annotations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  photo_id uuid not null references public.construction_docs_photos(id) on delete cascade,
  type text not null,
  geometry jsonb not null default '{}'::jsonb,
  text text null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint construction_docs_annotations_type_chk check (type in ('arrow', 'rect', 'text'))
);

create index if not exists idx_construction_docs_annotations_org_photo
  on public.construction_docs_annotations (org_id, photo_id, created_at asc);

create table if not exists public.construction_docs_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  doc_type text not null,
  name text not null,
  dsl jsonb not null,
  version int not null default 1,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint construction_docs_templates_doc_type_chk check (doc_type in ('INSPECTION', 'SOP', 'SCHEDULE'))
);

create index if not exists idx_construction_docs_templates_org_type_active
  on public.construction_docs_templates (org_id, doc_type, is_active, updated_at desc);

create table if not exists public.construction_docs_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  project_id uuid not null references public.projetos(id) on delete cascade,
  obra_id uuid null references public.obras(id) on delete set null,
  type text not null,
  status text not null default 'DRAFT',
  payload jsonb not null default '{}'::jsonb,
  rendered_html text null,
  pdf_key text null,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint construction_docs_documents_type_chk check (type in ('INSPECTION', 'SOP', 'SCHEDULE')),
  constraint construction_docs_documents_status_chk check (status in ('DRAFT', 'FINAL'))
);

create index if not exists idx_construction_docs_documents_org_project
  on public.construction_docs_documents (org_id, project_id, updated_at desc);

create index if not exists idx_construction_docs_documents_org_type_status
  on public.construction_docs_documents (org_id, type, status, updated_at desc);

create table if not exists public.construction_docs_share_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  document_id uuid not null references public.construction_docs_documents(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  password_hash text null,
  revoked_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_construction_docs_share_links_org_doc
  on public.construction_docs_share_links (org_id, document_id, created_at desc);

create index if not exists idx_construction_docs_share_links_token
  on public.construction_docs_share_links (token_hash);

create table if not exists public.construction_docs_audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  project_id uuid null references public.projetos(id) on delete set null,
  visit_id uuid null references public.construction_docs_visits(id) on delete set null,
  document_id uuid null references public.construction_docs_documents(id) on delete set null,
  event_type text not null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_construction_docs_audit_org_event_created
  on public.construction_docs_audit_logs (org_id, event_type, created_at desc);

alter table public.construction_docs_project_links enable row level security;
alter table public.construction_docs_visits enable row level security;
alter table public.construction_docs_rooms enable row level security;
alter table public.construction_docs_photos enable row level security;
alter table public.construction_docs_annotations enable row level security;
alter table public.construction_docs_templates enable row level security;
alter table public.construction_docs_documents enable row level security;
alter table public.construction_docs_share_links enable row level security;
alter table public.construction_docs_audit_logs enable row level security;

drop policy if exists construction_docs_project_links_org_read on public.construction_docs_project_links;
drop policy if exists construction_docs_project_links_org_write on public.construction_docs_project_links;
create policy construction_docs_project_links_org_read on public.construction_docs_project_links
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy construction_docs_project_links_org_write on public.construction_docs_project_links
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists construction_docs_visits_org_read on public.construction_docs_visits;
drop policy if exists construction_docs_visits_org_write on public.construction_docs_visits;
create policy construction_docs_visits_org_read on public.construction_docs_visits
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy construction_docs_visits_org_write on public.construction_docs_visits
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists construction_docs_rooms_org_read on public.construction_docs_rooms;
drop policy if exists construction_docs_rooms_org_write on public.construction_docs_rooms;
create policy construction_docs_rooms_org_read on public.construction_docs_rooms
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy construction_docs_rooms_org_write on public.construction_docs_rooms
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists construction_docs_photos_org_read on public.construction_docs_photos;
drop policy if exists construction_docs_photos_org_write on public.construction_docs_photos;
create policy construction_docs_photos_org_read on public.construction_docs_photos
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy construction_docs_photos_org_write on public.construction_docs_photos
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists construction_docs_annotations_org_read on public.construction_docs_annotations;
drop policy if exists construction_docs_annotations_org_write on public.construction_docs_annotations;
create policy construction_docs_annotations_org_read on public.construction_docs_annotations
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy construction_docs_annotations_org_write on public.construction_docs_annotations
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists construction_docs_templates_org_read on public.construction_docs_templates;
drop policy if exists construction_docs_templates_org_write on public.construction_docs_templates;
create policy construction_docs_templates_org_read on public.construction_docs_templates
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy construction_docs_templates_org_write on public.construction_docs_templates
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists construction_docs_documents_org_read on public.construction_docs_documents;
drop policy if exists construction_docs_documents_org_write on public.construction_docs_documents;
create policy construction_docs_documents_org_read on public.construction_docs_documents
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy construction_docs_documents_org_write on public.construction_docs_documents
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists construction_docs_share_links_org_read on public.construction_docs_share_links;
drop policy if exists construction_docs_share_links_org_write on public.construction_docs_share_links;
create policy construction_docs_share_links_org_read on public.construction_docs_share_links
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy construction_docs_share_links_org_write on public.construction_docs_share_links
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists construction_docs_audit_logs_org_read on public.construction_docs_audit_logs;
drop policy if exists construction_docs_audit_logs_org_write on public.construction_docs_audit_logs;
create policy construction_docs_audit_logs_org_read on public.construction_docs_audit_logs
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy construction_docs_audit_logs_org_write on public.construction_docs_audit_logs
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'construction-docs-media',
      'construction-docs-media',
      false,
      15728640,
      array['image/jpeg', 'image/png', 'image/webp']::text[]
    )
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'construction-docs-pdfs',
      'construction-docs-pdfs',
      false,
      15728640,
      array['application/pdf']::text[]
    )
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$$;
