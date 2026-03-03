-- STRKTR Wave1: General Tasks mini-kanban
-- Stage: expand
-- Non-breaking, additive only.

create table if not exists public.general_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  assignee_user_id uuid null references auth.users(id) on delete set null,
  title text not null,
  description text null,
  status text not null default 'todo',
  priority text not null default 'medium',
  position int not null default 0,
  due_date date null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint general_tasks_status_chk check (status in ('todo', 'in_progress', 'blocked', 'done')),
  constraint general_tasks_priority_chk check (priority in ('low', 'medium', 'high', 'urgent'))
);

create index if not exists idx_general_tasks_org_status_position
  on public.general_tasks (org_id, status, position, created_at desc);

create index if not exists idx_general_tasks_org_assignee
  on public.general_tasks (org_id, assignee_user_id);

create index if not exists idx_general_tasks_org_due
  on public.general_tasks (org_id, due_date);

alter table public.general_tasks enable row level security;

drop policy if exists general_tasks_org_read on public.general_tasks;
drop policy if exists general_tasks_org_write on public.general_tasks;
create policy general_tasks_org_read on public.general_tasks
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy general_tasks_org_write on public.general_tasks
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));
