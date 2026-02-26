with tracked_tables as (
  select *
  from (values
    ('obras'),
    ('obra_etapas'),
    ('obra_checklists'),
    ('checklist_items'),
    ('diario_obra'),
    ('transacoes'),
    ('compras'),
    ('leads'),
    ('projetos'),
    ('orcamentos'),
    ('orcamento_itens'),
    ('visitas'),
    ('equipe'),
    ('knowledgebase'),
    ('eventos_produto')
  ) t(table_name)
),
rls_status as (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
),
policy_counts as (
  select
    tablename as table_name,
    count(*)::int as policy_count
  from pg_policies
  where schemaname = 'public'
  group by tablename
)
select
  tt.table_name,
  coalesce(rs.rls_enabled, false) as rls_enabled,
  coalesce(rs.rls_forced, false) as rls_forced,
  coalesce(pc.policy_count, 0) as policy_count
from tracked_tables tt
left join rls_status rs on rs.table_name = tt.table_name
left join policy_counts pc on pc.table_name = tt.table_name
order by tt.table_name;
