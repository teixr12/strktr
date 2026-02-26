create table if not exists public.eventos_produto (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null,
  user_id uuid not null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_eventos_produto_org_created_at
  on public.eventos_produto (org_id, created_at desc);
