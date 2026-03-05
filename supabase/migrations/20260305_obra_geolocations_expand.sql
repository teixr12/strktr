-- STRKTR Wave2: Obra geolocation support (weather + map + logistics)
-- Non-breaking, additive only.

create table if not exists public.obra_geolocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  source text not null default 'manual',
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obra_geolocations_source_chk check (source in ('manual', 'geocoded', 'imported')),
  constraint obra_geolocations_lat_chk check (lat >= -90 and lat <= 90),
  constraint obra_geolocations_lng_chk check (lng >= -180 and lng <= 180),
  unique (org_id, obra_id)
);

create index if not exists idx_obra_geolocations_org_obra
  on public.obra_geolocations (org_id, obra_id);

create index if not exists idx_obra_geolocations_org_updated
  on public.obra_geolocations (org_id, updated_at desc);

alter table public.obra_geolocations enable row level security;

drop policy if exists obra_geolocations_org_read on public.obra_geolocations;
drop policy if exists obra_geolocations_org_write on public.obra_geolocations;

create policy obra_geolocations_org_read on public.obra_geolocations
for select using (org_id in (select public.get_user_org_ids(auth.uid())));

create policy obra_geolocations_org_write on public.obra_geolocations
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

