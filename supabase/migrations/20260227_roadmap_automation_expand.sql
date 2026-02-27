-- STRKTR Wave: personal roadmap + semi-automation
-- Stage: expand
-- Non-breaking, additive only.

create table if not exists public.roadmap_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_type text not null,
  action_code text not null,
  title text not null,
  description text null,
  status text not null default 'pending',
  due_at timestamptz null,
  source_module text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  trigger text not null,
  template_code text not null,
  enabled boolean not null default true,
  requires_review boolean not null default true,
  cooldown_hours int not null default 12,
  created_by uuid not null references auth.users(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  rule_id uuid null references public.automation_rules(id) on delete set null,
  trigger text not null,
  trigger_entity_type text not null,
  trigger_entity_id text not null,
  status text not null default 'preview',
  summary text null,
  error text null,
  requires_review boolean not null default false,
  run_source text not null default 'manual',
  preview jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.automation_outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  action_type text not null,
  action_key text not null,
  payload jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_roadmap_actions_org_user_status
  on public.roadmap_actions (org_id, user_id, status, due_at);
create index if not exists idx_roadmap_actions_org_created
  on public.roadmap_actions (org_id, created_at desc);

create index if not exists idx_automation_rules_org_trigger
  on public.automation_rules (org_id, trigger, enabled);
create index if not exists idx_automation_rules_org_created
  on public.automation_rules (org_id, created_at desc);

create index if not exists idx_automation_runs_org_status
  on public.automation_runs (org_id, status, created_at desc);
create index if not exists idx_automation_runs_org_trigger
  on public.automation_runs (org_id, trigger, created_at desc);

create unique index if not exists idx_automation_outbox_org_action_key
  on public.automation_outbox (org_id, action_key);

alter table public.roadmap_actions enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_outbox enable row level security;

-- roadmap is personal; user can only read/write own actions inside own orgs.
drop policy if exists roadmap_actions_read on public.roadmap_actions;
drop policy if exists roadmap_actions_write on public.roadmap_actions;
create policy roadmap_actions_read on public.roadmap_actions
for select using (
  org_id in (select public.get_user_org_ids(auth.uid()))
  and user_id = auth.uid()
);
create policy roadmap_actions_write on public.roadmap_actions
for all using (
  org_id in (select public.get_user_org_ids(auth.uid()))
  and user_id = auth.uid()
)
with check (
  org_id in (select public.get_user_org_ids(auth.uid()))
  and user_id = auth.uid()
);

-- automation rules/runs/outbox are org scoped for active members.
drop policy if exists automation_rules_org_read on public.automation_rules;
drop policy if exists automation_rules_org_write on public.automation_rules;
create policy automation_rules_org_read on public.automation_rules
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy automation_rules_org_write on public.automation_rules
for all using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists automation_runs_org_read on public.automation_runs;
drop policy if exists automation_runs_org_write on public.automation_runs;
create policy automation_runs_org_read on public.automation_runs
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy automation_runs_org_write on public.automation_runs
for all using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists automation_outbox_org_read on public.automation_outbox;
drop policy if exists automation_outbox_org_write on public.automation_outbox;
create policy automation_outbox_org_read on public.automation_outbox
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy automation_outbox_org_write on public.automation_outbox
for all using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));
