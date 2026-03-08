create table if not exists public.billing_subscription_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'note',
      'status_changed',
      'trial_started',
      'trial_ended',
      'renewal_scheduled',
      'renewed',
      'payment_failed',
      'paused',
      'resumed',
      'canceled',
      'manual_override'
    )
  ),
  actor_label text null,
  summary text not null,
  details text null,
  status_before text null check (status_before in ('inactive', 'sandbox', 'trialing', 'active', 'past_due', 'paused', 'canceled')),
  status_after text null check (status_after in ('inactive', 'sandbox', 'trialing', 'active', 'past_due', 'paused', 'canceled')),
  provider_code text null check (provider_code in ('stripe', 'mercadopago')),
  effective_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_subscription_events_org_effective
  on public.billing_subscription_events (org_id, effective_at desc, created_at desc);

alter table public.billing_subscription_events enable row level security;

drop policy if exists billing_subscription_events_org_read on public.billing_subscription_events;
create policy billing_subscription_events_org_read on public.billing_subscription_events
  for select using (org_id = public.current_org_id());

drop policy if exists billing_subscription_events_org_write on public.billing_subscription_events;
create policy billing_subscription_events_org_write on public.billing_subscription_events
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
