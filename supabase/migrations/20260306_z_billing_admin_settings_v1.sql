create table if not exists public.billing_admin_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  default_provider text not null default 'stripe' check (default_provider in ('stripe', 'mercadopago')),
  billing_email text null,
  support_email text null,
  terms_url text null,
  privacy_url text null,
  checkout_enabled boolean not null default false,
  sandbox_mode boolean not null default true,
  trial_days integer not null default 14 check (trial_days >= 0 and trial_days <= 90),
  monthly_price_cents integer null check (monthly_price_cents is null or monthly_price_cents >= 0),
  annual_price_cents integer null check (annual_price_cents is null or annual_price_cents >= 0),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_admin_settings_org_unique unique (org_id)
);

create index if not exists idx_billing_admin_settings_org_updated
  on public.billing_admin_settings (org_id, updated_at desc);

alter table public.billing_admin_settings enable row level security;

drop policy if exists billing_admin_settings_org_read on public.billing_admin_settings;
create policy billing_admin_settings_org_read on public.billing_admin_settings
  for select using (org_id = public.current_org_id());

drop policy if exists billing_admin_settings_org_write on public.billing_admin_settings;
create policy billing_admin_settings_org_write on public.billing_admin_settings
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
