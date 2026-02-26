select 'obras' as table_name, count(*)::bigint as org_id_nulls
from public.obras where org_id is null
union all
select 'obra_etapas', count(*)::bigint from public.obra_etapas where org_id is null
union all
select 'obra_checklists', count(*)::bigint from public.obra_checklists where org_id is null
union all
select 'checklist_items', count(*)::bigint from public.checklist_items where org_id is null
union all
select 'diario_obra', count(*)::bigint from public.diario_obra where org_id is null
union all
select 'transacoes', count(*)::bigint from public.transacoes where org_id is null
union all
select 'compras', count(*)::bigint from public.compras where org_id is null
union all
select 'leads', count(*)::bigint from public.leads where org_id is null
union all
select 'projetos', count(*)::bigint from public.projetos where org_id is null
union all
select 'orcamentos', count(*)::bigint from public.orcamentos where org_id is null
union all
select 'visitas', count(*)::bigint from public.visitas where org_id is null
union all
select 'eventos_produto', count(*)::bigint from public.eventos_produto where org_id is null
order by table_name;
