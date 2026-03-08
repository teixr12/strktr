alter table if exists public.public_api_client_tokens
  add column if not exists rate_limit_per_minute_override integer null
    check (rate_limit_per_minute_override is null or rate_limit_per_minute_override > 0),
  add column if not exists daily_quota_override integer null
    check (daily_quota_override is null or daily_quota_override > 0),
  add column if not exists monthly_call_budget_override integer null
    check (monthly_call_budget_override is null or monthly_call_budget_override > 0);
