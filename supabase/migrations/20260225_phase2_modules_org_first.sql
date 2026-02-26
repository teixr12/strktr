-- Phase 2 hardening: orcamentos + equipe + knowledgebase org-first

create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  titulo text not null,
  lead_id uuid null references public.leads(id) on delete set null,
  obra_id uuid null references public.obras(id) on delete set null,
  status text not null default 'Rascunho',
  validade date null,
  observacoes text null,
  valor_total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  org_id uuid not null references public.organizacoes(id) on delete cascade,
  descricao text not null,
  unidade text not null default 'm²',
  quantidade numeric not null default 1,
  valor_unitario numeric not null default 0,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_orcamentos_org_created_at
  on public.orcamentos (org_id, created_at desc);
create index if not exists idx_orcamentos_org_status
  on public.orcamentos (org_id, status);
create index if not exists idx_orcamento_itens_orcamento
  on public.orcamento_itens (orcamento_id, ordem);
create index if not exists idx_orcamento_itens_org
  on public.orcamento_itens (org_id, created_at desc);

alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;

drop policy if exists orcamentos_org_read on public.orcamentos;
drop policy if exists orcamentos_org_write on public.orcamentos;
create policy orcamentos_org_read on public.orcamentos
for select
using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy orcamentos_org_write on public.orcamentos
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

drop policy if exists orcamento_itens_org_read on public.orcamento_itens;
drop policy if exists orcamento_itens_org_write on public.orcamento_itens;
create policy orcamento_itens_org_read on public.orcamento_itens
for select
using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy orcamento_itens_org_write on public.orcamento_itens
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

-- equipe org-first
alter table if exists public.equipe add column if not exists org_id uuid;

do $$
begin
  if to_regclass('public.equipe') is not null and to_regclass('public.profiles') is not null then
    execute '
      update public.equipe e
         set org_id = p.org_id
        from public.profiles p
       where e.user_id = p.id
         and e.org_id is null
         and p.org_id is not null';
  end if;

  if to_regclass('public.equipe') is not null and to_regclass('public.org_membros') is not null then
    execute '
      update public.equipe e
         set org_id = om.org_id
        from public.org_membros om
       where e.user_id = om.user_id
         and om.status = ''ativo''
         and e.org_id is null';
  end if;
end $$;

create index if not exists idx_equipe_org_nome on public.equipe (org_id, nome);
create index if not exists idx_equipe_org_status on public.equipe (org_id, status);

alter table public.equipe enable row level security;
drop policy if exists equipe_own on public.equipe;
drop policy if exists equipe_org_read on public.equipe;
drop policy if exists equipe_org_write on public.equipe;
create policy equipe_org_read on public.equipe
for select
using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy equipe_org_write on public.equipe
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

do $$
begin
  if not exists (select 1 from public.equipe where org_id is null) then
    execute 'alter table public.equipe alter column org_id set not null';
  end if;
end $$;

-- knowledgebase org-first hardening
do $$
begin
  if to_regclass('public.knowledgebase') is not null and to_regclass('public.profiles') is not null then
    execute '
      update public.knowledgebase kb
         set org_id = p.org_id
        from public.profiles p
       where kb.user_id = p.id
         and kb.org_id is null
         and p.org_id is not null';
  end if;
end $$;

create index if not exists idx_knowledgebase_org_categoria
  on public.knowledgebase (org_id, categoria);
create index if not exists idx_knowledgebase_org_ativo
  on public.knowledgebase (org_id, ativo);

alter table public.knowledgebase enable row level security;
drop policy if exists knowledgebase_select on public.knowledgebase;
drop policy if exists knowledgebase_insert on public.knowledgebase;
drop policy if exists knowledgebase_update on public.knowledgebase;
drop policy if exists knowledgebase_delete on public.knowledgebase;
drop policy if exists knowledgebase_org_read on public.knowledgebase;
drop policy if exists knowledgebase_org_write on public.knowledgebase;
create policy knowledgebase_org_read on public.knowledgebase
for select
using (org_id in (select public.get_user_org_ids(auth.uid())));
create policy knowledgebase_org_write on public.knowledgebase
for all
using (org_id in (select public.get_user_org_ids(auth.uid())))
with check (org_id in (select public.get_user_org_ids(auth.uid())));

do $$
begin
  if not exists (select 1 from public.knowledgebase where org_id is null) then
    execute 'alter table public.knowledgebase alter column org_id set not null';
  end if;
end $$;
