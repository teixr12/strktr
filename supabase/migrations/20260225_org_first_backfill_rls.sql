-- STRKTR - Org-first tenancy hardening
-- Safe for partial schemas: only applies to tables that exist.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'obras','obra_etapas','obra_checklists','checklist_items','diario_obra',
    'transacoes','compras','leads','projetos','orcamentos','visitas','eventos_produto'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table public.%I add column if not exists org_id uuid', tbl);
    end if;
  end loop;
end $$;

-- Backfill org_id from profiles/org relations where columns exist.
do $$
begin
  if to_regclass('public.obras') is not null and to_regclass('public.profiles') is not null then
    execute 'update public.obras o set org_id = p.org_id from public.profiles p where o.user_id = p.id and o.org_id is null';
  end if;

  if to_regclass('public.obra_etapas') is not null and to_regclass('public.obras') is not null then
    execute 'update public.obra_etapas e set org_id = o.org_id from public.obras o where e.obra_id = o.id and e.org_id is null';
  end if;

  if to_regclass('public.obra_checklists') is not null and to_regclass('public.obras') is not null then
    execute 'update public.obra_checklists c set org_id = o.org_id from public.obras o where c.obra_id = o.id and c.org_id is null';
  end if;

  if to_regclass('public.checklist_items') is not null and to_regclass('public.obra_checklists') is not null then
    execute 'update public.checklist_items i set org_id = c.org_id from public.obra_checklists c where i.checklist_id = c.id and i.org_id is null';
  end if;

  if to_regclass('public.diario_obra') is not null and to_regclass('public.obras') is not null then
    execute 'update public.diario_obra d set org_id = o.org_id from public.obras o where d.obra_id = o.id and d.org_id is null';
  end if;

  if to_regclass('public.transacoes') is not null and to_regclass('public.profiles') is not null then
    execute 'update public.transacoes t set org_id = p.org_id from public.profiles p where t.user_id = p.id and t.org_id is null';
  end if;

  if to_regclass('public.compras') is not null and to_regclass('public.profiles') is not null then
    execute 'update public.compras c set org_id = p.org_id from public.profiles p where c.user_id = p.id and c.org_id is null';
  end if;

  if to_regclass('public.leads') is not null and to_regclass('public.profiles') is not null then
    execute 'update public.leads l set org_id = p.org_id from public.profiles p where l.user_id = p.id and l.org_id is null';
  end if;

  if to_regclass('public.projetos') is not null and to_regclass('public.profiles') is not null then
    execute 'update public.projetos p2 set org_id = p.org_id from public.profiles p where p2.user_id = p.id and p2.org_id is null';
  end if;

  if to_regclass('public.orcamentos') is not null and to_regclass('public.profiles') is not null then
    execute 'update public.orcamentos o2 set org_id = p.org_id from public.profiles p where o2.user_id = p.id and o2.org_id is null';
  end if;

  if to_regclass('public.visitas') is not null and to_regclass('public.profiles') is not null then
    execute 'update public.visitas v set org_id = p.org_id from public.profiles p where v.user_id = p.id and v.org_id is null';
  end if;

  if to_regclass('public.eventos_produto') is not null and to_regclass('public.profiles') is not null then
    execute 'update public.eventos_produto e set org_id = p.org_id from public.profiles p where e.user_id = p.id and e.org_id is null';
  end if;
end $$;

-- Indexes
create index if not exists idx_obras_org_created_at on public.obras (org_id, created_at desc);
create index if not exists idx_obras_org_status on public.obras (org_id, status);
create index if not exists idx_leads_org_created_at on public.leads (org_id, created_at desc);
create index if not exists idx_transacoes_org_data on public.transacoes (org_id, data desc);
create index if not exists idx_diario_obra_org_created_at on public.diario_obra (org_id, created_at desc);
create index if not exists idx_checklist_items_org_created_at on public.checklist_items (org_id, created_at desc);
create index if not exists idx_projetos_org_created_at on public.projetos (org_id, created_at desc);
create index if not exists idx_visitas_org_created_at on public.visitas (org_id, created_at desc);
create index if not exists idx_compras_org_created_at on public.compras (org_id, created_at desc);

-- Enable RLS and org-based policies
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'obras','obra_etapas','obra_checklists','checklist_items','diario_obra',
    'transacoes','compras','leads','projetos','orcamentos','visitas','eventos_produto'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table public.%I enable row level security', tbl);

      execute format('drop policy if exists %I_org_read on public.%I', tbl, tbl);
      execute format(
        'create policy %I_org_read on public.%I for select using (org_id in (select org_id from public.org_membros where user_id = auth.uid() and status = ''ativo''))',
        tbl, tbl
      );

      execute format('drop policy if exists %I_org_write on public.%I', tbl, tbl);
      execute format(
        'create policy %I_org_write on public.%I for all using (org_id in (select org_id from public.org_membros where user_id = auth.uid() and status = ''ativo'')) with check (org_id in (select org_id from public.org_membros where user_id = auth.uid() and status = ''ativo''))',
        tbl, tbl
      );
    end if;
  end loop;
end $$;

-- Enforce org_id not null only after validating zero null rows:
-- alter table public.obras alter column org_id set not null;
-- alter table public.obra_etapas alter column org_id set not null;
-- alter table public.obra_checklists alter column org_id set not null;
-- alter table public.checklist_items alter column org_id set not null;
-- alter table public.diario_obra alter column org_id set not null;
-- alter table public.transacoes alter column org_id set not null;
-- alter table public.compras alter column org_id set not null;
-- alter table public.leads alter column org_id set not null;
-- alter table public.projetos alter column org_id set not null;
-- alter table public.orcamentos alter column org_id set not null;
-- alter table public.visitas alter column org_id set not null;
-- alter table public.eventos_produto alter column org_id set not null;
