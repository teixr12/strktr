create table if not exists public.billing_provider_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  provider_code text not null check (provider_code in ('stripe', 'mercadopago')),
  operational_status text not null default 'planned' check (operational_status in ('planned', 'sandbox_ready', 'beta_ready', 'live_blocked')),
  rollout_mode text not null default 'internal' check (rollout_mode in ('internal', 'allowlist', 'closed_beta', 'general_blocked')),
  account_reference text null,
  publishable_key_hint text null,
  webhook_endpoint_hint text null,
  settlement_country text null,
  accepted_currencies text[] not null default array['BRL']::text[],
  supports_pix boolean not null default false,
  supports_cards boolean not null default true,
  notes text null,
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider_code)
);

create index if not exists idx_billing_provider_settings_org_provider
  on public.billing_provider_settings (org_id, provider_code);

alter table public.billing_provider_settings enable row level security;

drop policy if exists billing_provider_settings_org_read on public.billing_provider_settings;
create policy billing_provider_settings_org_read on public.billing_provider_settings
  for select using (org_id = public.current_org_id());

drop policy if exists billing_provider_settings_org_write on public.billing_provider_settings;
create policy billing_provider_settings_org_write on public.billing_provider_settings
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
