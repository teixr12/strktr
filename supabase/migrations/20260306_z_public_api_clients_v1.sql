create table if not exists public.public_api_clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'revoked')),
  scope_codes text[] not null default '{}',
  rate_limit_per_minute integer not null default 120 check (rate_limit_per_minute >= 10 and rate_limit_per_minute <= 10000),
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_public_api_clients_org_updated
  on public.public_api_clients (org_id, updated_at desc);

create index if not exists idx_public_api_clients_org_status
  on public.public_api_clients (org_id, status, updated_at desc);

alter table public.public_api_clients enable row level security;

drop policy if exists public_api_clients_org_read on public.public_api_clients;
create policy public_api_clients_org_read on public.public_api_clients
  for select using (org_id = public.current_org_id());

drop policy if exists public_api_clients_org_write on public.public_api_clients;
create policy public_api_clients_org_write on public.public_api_clients
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
