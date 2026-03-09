create table if not exists public.billing_plan_catalog (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  slug text not null,
  name text not null,
  description text null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  currency text not null default 'BRL',
  monthly_price_cents integer null check (monthly_price_cents is null or monthly_price_cents >= 0),
  annual_price_cents integer null check (annual_price_cents is null or annual_price_cents >= 0),
  trial_days integer not null default 14 check (trial_days >= 0 and trial_days <= 90),
  accepted_providers text[] not null default '{"stripe"}',
  feature_bullets text[] not null default '{}',
  featured boolean not null default false,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_billing_plan_catalog_org_slug
  on public.billing_plan_catalog (org_id, slug);

create index if not exists idx_billing_plan_catalog_org_status_updated
  on public.billing_plan_catalog (org_id, status, updated_at desc);

alter table public.billing_plan_catalog enable row level security;

drop policy if exists billing_plan_catalog_org_read on public.billing_plan_catalog;
create policy billing_plan_catalog_org_read on public.billing_plan_catalog
  for select using (org_id = public.current_org_id());

drop policy if exists billing_plan_catalog_org_write on public.billing_plan_catalog;
create policy billing_plan_catalog_org_write on public.billing_plan_catalog
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
