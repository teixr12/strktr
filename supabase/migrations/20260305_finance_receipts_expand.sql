-- STRKTR Finance Receipts V1
-- Additive only. Enables private receipt intake + attachment linking for financeiro.

create table if not exists public.transacao_receipt_intakes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  transacao_id uuid null references public.transacoes(id) on delete set null,
  storage_key text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  ocr_text text null,
  ai_payload jsonb null,
  review_payload jsonb null,
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transacao_receipt_intakes_status_chk check (status in ('uploaded', 'ready_for_review', 'linked', 'failed')),
  constraint transacao_receipt_intakes_size_chk check (size_bytes >= 0),
  unique (org_id, storage_key)
);

create index if not exists idx_transacao_receipt_intakes_org_created
  on public.transacao_receipt_intakes (org_id, created_at desc);

create index if not exists idx_transacao_receipt_intakes_org_transacao
  on public.transacao_receipt_intakes (org_id, transacao_id, updated_at desc);

create index if not exists idx_transacao_receipt_intakes_org_status
  on public.transacao_receipt_intakes (org_id, status, updated_at desc);

create table if not exists public.transacao_anexos (
  id uuid primary key default gen_random_uuid(),
  transacao_id uuid not null references public.transacoes(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  url text null,
  nome_arquivo text null,
  tipo_arquivo text null default 'image/jpeg',
  tamanho_bytes integer null,
  created_at timestamptz null default now(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  receipt_intake_id uuid null references public.transacao_receipt_intakes(id) on delete set null,
  storage_key text null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  constraint transacao_anexos_size_chk check (size_bytes >= 0)
);

alter table public.transacao_anexos
  add column if not exists org_id uuid references public.organizacoes(id) on delete cascade,
  add column if not exists receipt_intake_id uuid references public.transacao_receipt_intakes(id) on delete set null,
  add column if not exists storage_key text null,
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists created_by uuid references auth.users(id) on delete cascade;

alter table public.transacao_anexos
  alter column user_id drop not null,
  alter column url drop not null,
  alter column nome_arquivo drop not null,
  alter column created_at set default now();

update public.transacao_anexos a
set org_id = t.org_id
from public.transacoes t
where t.id = a.transacao_id
  and a.org_id is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transacao_anexos'
      and column_name = 'nome_arquivo'
  ) then
    execute $sql$
      update public.transacao_anexos a
      set original_filename = coalesce(a.original_filename, a.nome_arquivo, 'anexo'),
          mime_type = coalesce(a.mime_type, a.tipo_arquivo, 'application/octet-stream'),
          size_bytes = coalesce(a.size_bytes, a.tamanho_bytes::bigint, 0),
          created_by = coalesce(a.created_by, a.user_id, t.user_id),
          org_id = coalesce(a.org_id, t.org_id)
      from public.transacoes t
      where t.id = a.transacao_id
        and (
          a.original_filename is null
          or a.mime_type is null
          or a.size_bytes is null
          or a.created_by is null
          or a.org_id is null
        )
    $sql$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transacao_anexos_size_chk'
      and conrelid = 'public.transacao_anexos'::regclass
  ) then
    alter table public.transacao_anexos
      add constraint transacao_anexos_size_chk check (size_bytes >= 0);
  end if;
end
$$;

do $$
declare
  missing_count integer;
begin
  select count(*)
  into missing_count
  from public.transacao_anexos
  where org_id is null
     or original_filename is null
     or mime_type is null
     or size_bytes is null
     or created_by is null;

  if missing_count > 0 then
    raise exception 'transacao_anexos backfill incomplete for % rows', missing_count;
  end if;
end
$$;

alter table public.transacao_anexos
  alter column org_id set not null,
  alter column original_filename set not null,
  alter column mime_type set not null,
  alter column size_bytes set not null,
  alter column created_by set not null;

create index if not exists idx_transacao_anexos_org_transacao
  on public.transacao_anexos (org_id, transacao_id, created_at desc);

create index if not exists idx_transacao_anexos_org_receipt_intake
  on public.transacao_anexos (org_id, receipt_intake_id);

create unique index if not exists idx_transacao_anexos_org_storage_key_unique
  on public.transacao_anexos (org_id, storage_key)
  where storage_key is not null;

alter table public.transacao_receipt_intakes enable row level security;
alter table public.transacao_anexos enable row level security;

drop policy if exists transacao_receipt_intakes_org_read on public.transacao_receipt_intakes;
drop policy if exists transacao_receipt_intakes_org_write on public.transacao_receipt_intakes;
create policy transacao_receipt_intakes_org_read on public.transacao_receipt_intakes
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy transacao_receipt_intakes_org_write on public.transacao_receipt_intakes
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists transacao_anexos_org_read on public.transacao_anexos;
drop policy if exists transacao_anexos_org_write on public.transacao_anexos;
create policy transacao_anexos_org_read on public.transacao_anexos
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy transacao_anexos_org_write on public.transacao_anexos
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'finance-receipts',
      'finance-receipts',
      false,
      15728640,
      array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
    )
    on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$$;
