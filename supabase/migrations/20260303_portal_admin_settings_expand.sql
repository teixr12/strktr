-- STRKTR Portal Admin: settings table for per-obra portal governance
-- Stage: expand
-- Non-breaking, additive only.

create table if not exists public.portal_admin_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  branding_nome text null,
  branding_logo_url text null,
  branding_cor_primaria text not null default '#D4A574',
  mensagem_boas_vindas text null,
  notificar_por_email boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, obra_id)
);

create index if not exists idx_portal_admin_settings_org_obra
  on public.portal_admin_settings (org_id, obra_id);

alter table public.portal_admin_settings enable row level security;

drop policy if exists portal_admin_settings_org_read on public.portal_admin_settings;
drop policy if exists portal_admin_settings_org_write on public.portal_admin_settings;
create policy portal_admin_settings_org_read on public.portal_admin_settings
for select using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy portal_admin_settings_org_write on public.portal_admin_settings
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

