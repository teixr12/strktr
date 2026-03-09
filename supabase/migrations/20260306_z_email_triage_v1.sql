create table if not exists public.email_triage_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  source text not null default 'manual' check (source in ('manual', 'forwarded', 'integration')),
  sender_name text null,
  sender_email text not null,
  subject text not null,
  snippet text null,
  classification text not null default 'unknown' check (classification in ('lead', 'supplier', 'client', 'operations', 'spam', 'unknown')),
  status text not null default 'new' check (status in ('new', 'reviewing', 'qualified', 'ignored', 'archived')),
  lead_id uuid null references public.leads(id) on delete set null,
  received_at timestamptz not null,
  reviewed_at timestamptz null,
  notes text null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_triage_org_received
  on public.email_triage_items (org_id, received_at desc);
create index if not exists idx_email_triage_org_status
  on public.email_triage_items (org_id, status, classification);
create index if not exists idx_email_triage_org_lead
  on public.email_triage_items (org_id, lead_id);
create index if not exists idx_email_triage_org_sender
  on public.email_triage_items (org_id, sender_email);

alter table public.email_triage_items enable row level security;

drop policy if exists email_triage_items_org_read on public.email_triage_items;
create policy email_triage_items_org_read on public.email_triage_items
  for select using (org_id = public.current_org_id());

drop policy if exists email_triage_items_org_write on public.email_triage_items;
create policy email_triage_items_org_write on public.email_triage_items
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
