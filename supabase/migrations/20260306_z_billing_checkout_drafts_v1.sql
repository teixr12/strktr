create table if not exists public.billing_checkout_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  plan_slug text not null default 'strktr-pro',
  headline text null,
  subheadline text null,
  currency text not null default 'BRL',
  monthly_price_cents integer null check (monthly_price_cents >= 0),
  annual_price_cents integer null check (annual_price_cents >= 0),
  trial_days_override integer null check (trial_days_override >= 0 and trial_days_override <= 90),
  primary_cta_label text null,
  accepted_providers text[] not null default '{"stripe"}',
  feature_bullets text[] not null default '{}',
  mode text not null default 'disabled' check (mode in ('disabled', 'sandbox')),
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_checkout_drafts_org_unique unique (org_id),
  constraint billing_checkout_drafts_currency_chk check (char_length(currency) = 3)
);

create index if not exists idx_billing_checkout_drafts_org_updated
  on public.billing_checkout_drafts (org_id, updated_at desc);

alter table public.billing_checkout_drafts enable row level security;

drop policy if exists billing_checkout_drafts_org_read on public.billing_checkout_drafts;
create policy billing_checkout_drafts_org_read on public.billing_checkout_drafts
  for select using (org_id = public.current_org_id());

drop policy if exists billing_checkout_drafts_org_write on public.billing_checkout_drafts;
create policy billing_checkout_drafts_org_write on public.billing_checkout_drafts
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
