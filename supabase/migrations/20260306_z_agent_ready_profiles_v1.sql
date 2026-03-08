create table if not exists public.agent_ready_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  name text not null,
  agent_type text not null check (agent_type in ('internal_assistant', 'external_llm', 'workflow_agent', 'human_proxy')),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'revoked')),
  scope_codes text[] not null default '{}',
  action_codes text[] not null default '{}',
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_ready_profiles_org_updated
  on public.agent_ready_profiles (org_id, updated_at desc);

create index if not exists idx_agent_ready_profiles_org_status
  on public.agent_ready_profiles (org_id, status, updated_at desc);

alter table public.agent_ready_profiles enable row level security;

drop policy if exists agent_ready_profiles_org_read on public.agent_ready_profiles;
create policy agent_ready_profiles_org_read on public.agent_ready_profiles
  for select using (org_id = public.current_org_id());

drop policy if exists agent_ready_profiles_org_write on public.agent_ready_profiles;
create policy agent_ready_profiles_org_write on public.agent_ready_profiles
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
