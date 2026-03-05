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
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  transacao_id uuid not null references public.transacoes(id) on delete cascade,
  receipt_intake_id uuid null references public.transacao_receipt_intakes(id) on delete set null,
  storage_key text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint transacao_anexos_size_chk check (size_bytes >= 0),
  unique (org_id, storage_key)
);

create index if not exists idx_transacao_anexos_org_transacao
  on public.transacao_anexos (org_id, transacao_id, created_at desc);

create index if not exists idx_transacao_anexos_org_receipt_intake
  on public.transacao_anexos (org_id, receipt_intake_id);

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
