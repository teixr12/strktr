begin;

create temporary table tmp_qa_users on commit drop as
select id
from auth.users
where email like 'codex.qa.%@example.com';

create temporary table tmp_qa_orgs on commit drop as
select om.org_id
from public.org_membros om
group by om.org_id
having bool_and(om.user_id in (select id from tmp_qa_users));

-- New wave entities (cronograma + portal + approval)
delete from public.portal_comentarios where org_id in (select org_id from tmp_qa_orgs);
delete from public.portal_sessions where org_id in (select org_id from tmp_qa_orgs);
delete from public.portal_clientes where org_id in (select org_id from tmp_qa_orgs);
delete from public.aprovacoes_cliente where org_id in (select org_id from tmp_qa_orgs);
delete from public.cronograma_dependencias where org_id in (select org_id from tmp_qa_orgs);
delete from public.cronograma_itens where org_id in (select org_id from tmp_qa_orgs);
delete from public.cronograma_baselines where org_id in (select org_id from tmp_qa_orgs);
delete from public.cronograma_pdf_exports where org_id in (select org_id from tmp_qa_orgs);
delete from public.cronograma_obras where org_id in (select org_id from tmp_qa_orgs);

-- Org-scoped business data (safe: only orgs fully owned by QA users)
delete from public.eventos_produto where org_id in (select org_id from tmp_qa_orgs);
delete from public.diario_obra where org_id in (select org_id from tmp_qa_orgs);
delete from public.checklist_items where org_id in (select org_id from tmp_qa_orgs);
delete from public.obra_checklists where org_id in (select org_id from tmp_qa_orgs);
delete from public.obra_etapas where org_id in (select org_id from tmp_qa_orgs);
delete from public.obras where org_id in (select org_id from tmp_qa_orgs);
delete from public.transacoes where org_id in (select org_id from tmp_qa_orgs);
delete from public.compras where org_id in (select org_id from tmp_qa_orgs);
delete from public.leads where org_id in (select org_id from tmp_qa_orgs);
delete from public.projetos where org_id in (select org_id from tmp_qa_orgs);
delete from public.orcamento_itens where org_id in (select org_id from tmp_qa_orgs);
delete from public.orcamentos where org_id in (select org_id from tmp_qa_orgs);
delete from public.visitas where org_id in (select org_id from tmp_qa_orgs);
delete from public.knowledgebase where org_id in (select org_id from tmp_qa_orgs);
delete from public.equipe where org_id in (select org_id from tmp_qa_orgs);

-- User-scoped data
update public.profiles
set org_id = null
where id in (select id from tmp_qa_users);

delete from public.notificacoes where user_id in (select id from tmp_qa_users);
delete from public.org_membros
where user_id in (select id from tmp_qa_users)
   or org_id in (select org_id from tmp_qa_orgs);

delete from public.organizacoes where id in (select org_id from tmp_qa_orgs);
delete from public.profiles where id in (select id from tmp_qa_users);
delete from auth.users where id in (select id from tmp_qa_users);

commit;
