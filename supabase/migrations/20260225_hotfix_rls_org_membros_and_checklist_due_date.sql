-- Hotfix: remove RLS recursion on org_membros and add checklist due date column

alter table if exists public.checklist_items
  add column if not exists data_limite date null;

create or replace function public.get_user_org_ids(uid uuid)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select om.org_id
  from public.org_membros om
  where om.user_id = uid and om.status = 'ativo';
$$;

create or replace function public.is_org_admin(uid uuid, oid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_membros om
    where om.user_id = uid
      and om.org_id = oid
      and om.status = 'ativo'
      and om.role = 'admin'
  );
$$;

revoke all on function public.get_user_org_ids(uuid) from public;
revoke all on function public.is_org_admin(uuid, uuid) from public;
grant execute on function public.get_user_org_ids(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid, uuid) to authenticated;

drop policy if exists "Org members can read membros" on public.org_membros;
drop policy if exists "Admins can manage membros" on public.org_membros;
drop policy if exists "Users can insert own membership" on public.org_membros;
drop policy if exists org_membros_org_read on public.org_membros;
drop policy if exists org_membros_org_write on public.org_membros;
drop policy if exists org_membros_self_read on public.org_membros;
drop policy if exists org_membros_admin_write on public.org_membros;
drop policy if exists org_membros_self_insert on public.org_membros;

alter table public.org_membros enable row level security;

create policy org_membros_self_read on public.org_membros
for select
using (user_id = auth.uid());

create policy org_membros_org_read on public.org_membros
for select
using (org_id in (select public.get_user_org_ids(auth.uid())));

create policy org_membros_admin_write on public.org_membros
for all
using (public.is_org_admin(auth.uid(), org_id))
with check (public.is_org_admin(auth.uid(), org_id));

create policy org_membros_self_insert on public.org_membros
for insert
with check (auth.uid() = user_id);
