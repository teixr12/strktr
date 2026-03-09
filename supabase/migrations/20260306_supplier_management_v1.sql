-- STRKTR Supplier Management V1
-- Stage: additive foundation

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  nome text not null,
  documento text null,
  email text null,
  telefone text null,
  cidade text null,
  estado text null,
  status text not null default 'active',
  score_manual integer not null default 60,
  notas text null,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fornecedores_status_chk check (status in ('active', 'watchlist', 'blocked')),
  constraint fornecedores_score_chk check (score_manual >= 0 and score_manual <= 100)
);

create index if not exists idx_fornecedores_org_updated
  on public.fornecedores (org_id, updated_at desc);

create index if not exists idx_fornecedores_org_status
  on public.fornecedores (org_id, status, updated_at desc);

create index if not exists idx_fornecedores_org_nome
  on public.fornecedores (org_id, nome);

alter table public.fornecedores enable row level security;

drop policy if exists fornecedores_org_read on public.fornecedores;
drop policy if exists fornecedores_org_write on public.fornecedores;
create policy fornecedores_org_read on public.fornecedores
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy fornecedores_org_write on public.fornecedores
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));
