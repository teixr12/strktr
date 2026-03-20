create unique index if not exists idx_fornecedores_org_id_id
  on public.fornecedores (org_id, id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fornecedores_org_id_id_unique'
      and conrelid = 'public.fornecedores'::regclass
  ) then
    alter table public.fornecedores
      add constraint fornecedores_org_id_id_unique
      unique using index idx_fornecedores_org_id_id;
  end if;
end
$$;

alter table public.burocracia_itens
  add column if not exists supplier_id uuid null;

create index if not exists idx_burocracia_itens_org_supplier_updated_at
  on public.burocracia_itens (org_id, supplier_id, updated_at desc)
  where supplier_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'burocracia_itens_org_supplier_fk'
      and conrelid = 'public.burocracia_itens'::regclass
  ) then
    alter table public.burocracia_itens
      add constraint burocracia_itens_org_supplier_fk
      foreign key (org_id, supplier_id)
      references public.fornecedores (org_id, id)
      on delete set null (supplier_id);
  end if;
end
$$;
