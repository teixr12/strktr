-- STRKTR Wave1: SOP Builder V1
-- Stage: expand
-- Non-breaking, additive only.

create table if not exists public.sops (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  obra_id uuid null references public.obras(id) on delete set null,
  projeto_id uuid null references public.projetos(id) on delete set null,
  title text not null,
  description text null,
  status text not null default 'draft',
  blocks jsonb not null default '[]'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sops_status_chk check (status in ('draft', 'published', 'archived'))
);

create index if not exists idx_sops_org_created_at
  on public.sops (org_id, created_at desc);

create index if not exists idx_sops_org_status
  on public.sops (org_id, status);

create index if not exists idx_sops_org_obra
  on public.sops (org_id, obra_id);

alter table public.sops enable row level security;

drop policy if exists sops_org_read on public.sops;
drop policy if exists sops_org_write on public.sops;
create policy sops_org_read on public.sops
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy sops_org_write on public.sops
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));
