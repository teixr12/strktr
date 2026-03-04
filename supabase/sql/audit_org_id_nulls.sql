create temp table if not exists audit_org_id_nulls_result (
  table_name text not null,
  table_exists boolean not null,
  org_id_nulls bigint null
) on commit drop;

truncate table audit_org_id_nulls_result;

do $$
declare
  table_name text;
  tracked_tables text[] := array[
    'obras',
    'obra_etapas',
    'obra_checklists',
    'checklist_items',
    'diario_obra',
    'transacoes',
    'compras',
    'leads',
    'projetos',
    'orcamentos',
    'visitas',
    'eventos_produto',
    'cronograma_obras',
    'cronograma_itens',
    'cronograma_dependencias',
    'cronograma_baselines',
    'portal_clientes',
    'portal_sessions',
    'portal_comentarios',
    'aprovacoes_cliente',
    'general_tasks',
    'sops',
    'construction_docs_project_links',
    'construction_docs_visits',
    'construction_docs_rooms',
    'construction_docs_photos',
    'construction_docs_annotations',
    'construction_docs_templates',
    'construction_docs_documents',
    'construction_docs_share_links',
    'construction_docs_audit_logs',
    'cronograma_pdf_exports'
  ];
begin
  foreach table_name in array tracked_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      insert into audit_org_id_nulls_result (table_name, table_exists, org_id_nulls)
      values (table_name, false, null);
    else
      execute format(
        'insert into audit_org_id_nulls_result (table_name, table_exists, org_id_nulls) select %L, true, count(*)::bigint from public.%I where org_id is null',
        table_name,
        table_name
      );
    end if;
  end loop;
end
$$;

select table_name, table_exists, org_id_nulls
from audit_org_id_nulls_result
order by table_name;
