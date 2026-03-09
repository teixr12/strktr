create table if not exists public.billing_subscription_states (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  status text not null default 'inactive' check (status in ('inactive', 'sandbox', 'trialing', 'active', 'past_due', 'paused', 'canceled')),
  provider_code text not null default 'stripe' check (provider_code in ('stripe', 'mercadopago')),
  plan_slug text null,
  external_customer_ref text null,
  external_subscription_ref text null,
  current_period_start_at timestamptz null,
  current_period_end_at timestamptz null,
  trial_ends_at timestamptz null,
  cancel_at_period_end boolean not null default false,
  auto_renew boolean not null default false,
  launched_at timestamptz null,
  last_synced_at timestamptz null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscription_states_org_unique unique (org_id)
);

create index if not exists idx_billing_subscription_states_org_updated
  on public.billing_subscription_states (org_id, updated_at desc);

alter table public.billing_subscription_states enable row level security;

drop policy if exists billing_subscription_states_org_read on public.billing_subscription_states;
create policy billing_subscription_states_org_read on public.billing_subscription_states
  for select using (org_id = public.current_org_id());

drop policy if exists billing_subscription_states_org_write on public.billing_subscription_states;
create policy billing_subscription_states_org_write on public.billing_subscription_states
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
