with qa_users as (
  select id
  from auth.users
  where email like 'codex.qa.%@example.com'
),
qa_orgs as (
  select om.org_id
  from public.org_membros om
  group by om.org_id
  having bool_and(om.user_id in (select id from qa_users))
),
metrics as (
  select 'qa_users'::text as metric, count(*)::bigint as total from qa_users
  union all
  select 'qa_orgs', count(*)::bigint from qa_orgs
  union all
  select 'org_membros.qa_users', count(*)::bigint
    from public.org_membros
   where user_id in (select id from qa_users)
  union all
  select 'profiles.qa_users', count(*)::bigint
    from public.profiles
   where id in (select id from qa_users)
  union all
  select 'eventos_produto.qa_orgs', count(*)::bigint
    from public.eventos_produto
   where org_id in (select org_id from qa_orgs)
  union all
  select 'obras.qa_orgs', count(*)::bigint
    from public.obras
   where org_id in (select org_id from qa_orgs)
  union all
  select 'transacoes.qa_orgs', count(*)::bigint
    from public.transacoes
   where org_id in (select org_id from qa_orgs)
  union all
  select 'compras.qa_orgs', count(*)::bigint
    from public.compras
   where org_id in (select org_id from qa_orgs)
  union all
  select 'leads.qa_orgs', count(*)::bigint
    from public.leads
   where org_id in (select org_id from qa_orgs)
  union all
  select 'projetos.qa_orgs', count(*)::bigint
    from public.projetos
   where org_id in (select org_id from qa_orgs)
  union all
  select 'orcamentos.qa_orgs', count(*)::bigint
    from public.orcamentos
   where org_id in (select org_id from qa_orgs)
  union all
  select 'orcamento_itens.qa_orgs', count(*)::bigint
    from public.orcamento_itens
   where org_id in (select org_id from qa_orgs)
  union all
  select 'visitas.qa_orgs', count(*)::bigint
    from public.visitas
   where org_id in (select org_id from qa_orgs)
  union all
  select 'knowledgebase.qa_orgs', count(*)::bigint
    from public.knowledgebase
   where org_id in (select org_id from qa_orgs)
  union all
  select 'equipe.qa_orgs', count(*)::bigint
    from public.equipe
   where org_id in (select org_id from qa_orgs)
  union all
  select 'cronograma_obras.qa_orgs', count(*)::bigint
    from public.cronograma_obras
   where org_id in (select org_id from qa_orgs)
  union all
  select 'cronograma_itens.qa_orgs', count(*)::bigint
    from public.cronograma_itens
   where org_id in (select org_id from qa_orgs)
  union all
  select 'aprovacoes_cliente.qa_orgs', count(*)::bigint
    from public.aprovacoes_cliente
   where org_id in (select org_id from qa_orgs)
  union all
  select 'portal_clientes.qa_orgs', count(*)::bigint
    from public.portal_clientes
   where org_id in (select org_id from qa_orgs)
  union all
  select 'portal_sessions.qa_orgs', count(*)::bigint
    from public.portal_sessions
   where org_id in (select org_id from qa_orgs)
  union all
  select 'portal_comentarios.qa_orgs', count(*)::bigint
    from public.portal_comentarios
   where org_id in (select org_id from qa_orgs)
  union all
  select 'cronograma_pdf_exports.qa_orgs', count(*)::bigint
    from public.cronograma_pdf_exports
   where org_id in (select org_id from qa_orgs)
  union all
  select 'notificacoes.qa_users', count(*)::bigint
    from public.notificacoes
   where user_id in (select id from qa_users)
)
select metric, total
from metrics
order by metric;
