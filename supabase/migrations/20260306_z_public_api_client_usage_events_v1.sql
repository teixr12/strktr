create table if not exists public.public_api_client_usage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  client_id uuid not null references public.public_api_clients(id) on delete cascade,
  token_id uuid null references public.public_api_client_tokens(id) on delete set null,
  source text not null default 'internal',
  endpoint_family text not null,
  outcome text not null check (outcome in ('success', 'error', 'rate_limited', 'blocked')),
  call_count integer not null default 1 check (call_count > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists public_api_client_usage_events_org_created_idx
  on public.public_api_client_usage_events (org_id, created_at desc);

create index if not exists public_api_client_usage_events_client_created_idx
  on public.public_api_client_usage_events (client_id, created_at desc);

create index if not exists public_api_client_usage_events_token_created_idx
  on public.public_api_client_usage_events (token_id, created_at desc);

alter table public.public_api_client_usage_events enable row level security;

drop policy if exists "public_api_client_usage_events_select_org" on public.public_api_client_usage_events;
create policy "public_api_client_usage_events_select_org"
  on public.public_api_client_usage_events
  for select
  using (
    org_id in (
      select m.org_id
      from public.membros m
      where m.user_id = auth.uid()
    )
  );

drop policy if exists "public_api_client_usage_events_insert_org" on public.public_api_client_usage_events;
create policy "public_api_client_usage_events_insert_org"
  on public.public_api_client_usage_events
  for insert
  with check (
    org_id in (
      select m.org_id
      from public.membros m
      where m.user_id = auth.uid()
    )
  );

drop policy if exists "public_api_client_usage_events_update_org" on public.public_api_client_usage_events;
create policy "public_api_client_usage_events_update_org"
  on public.public_api_client_usage_events
  for update
  using (
    org_id in (
      select m.org_id
      from public.membros m
      where m.user_id = auth.uid()
    )
  )
  with check (
    org_id in (
      select m.org_id
      from public.membros m
      where m.user_id = auth.uid()
    )
  );

drop policy if exists "public_api_client_usage_events_delete_org" on public.public_api_client_usage_events;
create policy "public_api_client_usage_events_delete_org"
  on public.public_api_client_usage_events
  for delete
  using (
    org_id in (
      select m.org_id
      from public.membros m
      where m.user_id = auth.uid()
    )
  );
