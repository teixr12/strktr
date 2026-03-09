alter table public.public_api_clients
  add column if not exists exposure text;

update public.public_api_clients
set exposure = 'internal_only'
where exposure is null;

alter table public.public_api_clients
  alter column exposure set default 'internal_only';

alter table public.public_api_clients
  alter column exposure set not null;

alter table public.public_api_clients
  drop constraint if exists public_api_clients_exposure_check;

alter table public.public_api_clients
  add constraint public_api_clients_exposure_check
  check (exposure in ('internal_only', 'allowlist', 'beta', 'general_blocked'));

alter table public.public_api_clients
  add column if not exists daily_quota integer;

update public.public_api_clients
set daily_quota = 10000
where daily_quota is null;

alter table public.public_api_clients
  alter column daily_quota set default 10000;

alter table public.public_api_clients
  alter column daily_quota set not null;

alter table public.public_api_clients
  drop constraint if exists public_api_clients_daily_quota_check;

alter table public.public_api_clients
  add constraint public_api_clients_daily_quota_check
  check (daily_quota >= 100 and daily_quota <= 10000000);

alter table public.public_api_clients
  add column if not exists monthly_call_budget integer;

update public.public_api_clients
set monthly_call_budget = 250000
where monthly_call_budget is null;

alter table public.public_api_clients
  alter column monthly_call_budget set default 250000;

alter table public.public_api_clients
  alter column monthly_call_budget set not null;

alter table public.public_api_clients
  drop constraint if exists public_api_clients_monthly_call_budget_check;

alter table public.public_api_clients
  add constraint public_api_clients_monthly_call_budget_check
  check (monthly_call_budget >= 1000 and monthly_call_budget <= 100000000);

alter table public.public_api_clients
  drop constraint if exists public_api_clients_budget_vs_daily_check;

alter table public.public_api_clients
  add constraint public_api_clients_budget_vs_daily_check
  check (monthly_call_budget >= daily_quota);

alter table public.public_api_clients
  add column if not exists owner_email text null;
