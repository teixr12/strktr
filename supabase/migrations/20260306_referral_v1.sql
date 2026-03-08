create table if not exists public.referral_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  code text not null unique,
  invited_email text,
  referred_name text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'activated', 'rewarded', 'expired')),
  reward_cents integer not null default 0,
  notes text,
  expires_at timestamptz,
  sent_at timestamptz,
  activated_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists referral_invites_org_id_idx
  on public.referral_invites (org_id);

create index if not exists referral_invites_org_status_idx
  on public.referral_invites (org_id, status, updated_at desc);

create index if not exists referral_invites_org_email_idx
  on public.referral_invites (org_id, invited_email);

alter table public.referral_invites enable row level security;

create policy if not exists referral_invites_select_org
  on public.referral_invites
  for select
  using (org_id = public.current_org_id());

create policy if not exists referral_invites_insert_org
  on public.referral_invites
  for insert
  with check (org_id = public.current_org_id());

create policy if not exists referral_invites_update_org
  on public.referral_invites
  for update
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create or replace function public.set_referral_invites_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_referral_invites_updated_at on public.referral_invites;
create trigger set_referral_invites_updated_at
before update on public.referral_invites
for each row execute function public.set_referral_invites_updated_at();
