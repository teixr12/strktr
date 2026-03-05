-- STRKTR Wave2: Organization HQ and address-first obra geolocation support.
-- Non-breaking and additive only.

alter table public.obra_geolocations
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists formatted_address text;

create table if not exists public.org_hq_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  cep text null,
  logradouro text null,
  numero text null,
  complemento text null,
  bairro text null,
  cidade text null,
  estado text null,
  formatted_address text null,
  lat double precision not null,
  lng double precision not null,
  source text not null default 'manual',
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_hq_locations_source_chk check (source in ('manual', 'geocoded', 'imported')),
  constraint org_hq_locations_lat_chk check (lat >= -90 and lat <= 90),
  constraint org_hq_locations_lng_chk check (lng >= -180 and lng <= 180),
  unique (org_id)
);

create index if not exists idx_org_hq_locations_org_updated
  on public.org_hq_locations (org_id, updated_at desc);

alter table public.org_hq_locations enable row level security;

drop policy if exists org_hq_locations_org_read on public.org_hq_locations;
drop policy if exists org_hq_locations_org_write on public.org_hq_locations;

create policy org_hq_locations_org_read on public.org_hq_locations
for select using (org_id in (select public.get_user_org_ids(auth.uid())));

create policy org_hq_locations_org_write on public.org_hq_locations
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));
