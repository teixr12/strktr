create table if not exists public.integration_provider_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  provider_code text not null,
  enabled boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'configured', 'blocked')),
  rollout_mode text not null default 'disabled' check (rollout_mode in ('disabled', 'sandbox', 'beta', 'live')),
  owner_email text null,
  callback_url text null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_provider_settings_provider_chk check (
    provider_code in (
      'whatsapp_business',
      'google_calendar',
      'resend',
      'posthog',
      'stripe',
      'mercadopago',
      'notion',
      'slack',
      'google_sheets',
      'webhooks',
      'sicoob_api'
    )
  ),
  constraint integration_provider_settings_org_provider_uniq unique (org_id, provider_code)
);

create index if not exists idx_integration_provider_settings_org_updated
  on public.integration_provider_settings (org_id, updated_at desc);

create index if not exists idx_integration_provider_settings_org_status
  on public.integration_provider_settings (org_id, status, updated_at desc);

alter table public.integration_provider_settings enable row level security;

drop policy if exists integration_provider_settings_org_read on public.integration_provider_settings;
create policy integration_provider_settings_org_read on public.integration_provider_settings
  for select using (org_id = public.current_org_id());

drop policy if exists integration_provider_settings_org_write on public.integration_provider_settings;
create policy integration_provider_settings_org_write on public.integration_provider_settings
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
