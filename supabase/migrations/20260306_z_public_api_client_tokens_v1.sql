create table if not exists public.public_api_client_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  client_id uuid not null references public.public_api_clients(id) on delete cascade,
  label text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  exposure text not null default 'internal_only' check (exposure in ('internal_only', 'allowlist', 'beta', 'general_blocked')),
  token_prefix text not null,
  token_last_four text not null,
  token_hash text not null,
  expires_at timestamptz null,
  last_used_at timestamptz null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_public_api_client_tokens_org_hash
  on public.public_api_client_tokens (org_id, token_hash);

create index if not exists idx_public_api_client_tokens_org_client_updated
  on public.public_api_client_tokens (org_id, client_id, updated_at desc);

create index if not exists idx_public_api_client_tokens_org_client_status
  on public.public_api_client_tokens (org_id, client_id, status, updated_at desc);

alter table public.public_api_client_tokens enable row level security;

drop policy if exists public_api_client_tokens_org_read on public.public_api_client_tokens;
create policy public_api_client_tokens_org_read on public.public_api_client_tokens
  for select using (org_id = public.current_org_id());

drop policy if exists public_api_client_tokens_org_write on public.public_api_client_tokens;
create policy public_api_client_tokens_org_write on public.public_api_client_tokens
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
