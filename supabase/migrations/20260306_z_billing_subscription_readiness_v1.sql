create table if not exists public.billing_subscription_readiness (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  selected_plan_slug text null,
  preferred_provider text not null default 'stripe' check (preferred_provider in ('stripe', 'mercadopago')),
  billing_contact_name text null,
  billing_contact_email text null,
  finance_owner_name text null,
  finance_owner_email text null,
  company_legal_name text null,
  company_address text null,
  launch_mode text not null default 'internal_preview' check (launch_mode in ('internal_preview', 'allowlist_beta', 'general_blocked')),
  kyc_status text not null default 'not_started' check (kyc_status in ('not_started', 'in_progress', 'ready')),
  terms_accepted boolean not null default false,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscription_readiness_org_unique unique (org_id)
);

create index if not exists idx_billing_subscription_readiness_org_updated
  on public.billing_subscription_readiness (org_id, updated_at desc);

alter table public.billing_subscription_readiness enable row level security;

drop policy if exists billing_subscription_readiness_org_read on public.billing_subscription_readiness;
create policy billing_subscription_readiness_org_read on public.billing_subscription_readiness
  for select using (org_id = public.current_org_id());

drop policy if exists billing_subscription_readiness_org_write on public.billing_subscription_readiness;
create policy billing_subscription_readiness_org_write on public.billing_subscription_readiness
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
