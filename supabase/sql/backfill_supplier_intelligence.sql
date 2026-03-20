with today as (
  select timezone('America/Sao_Paulo', now())::date as value
),
supplier_snapshots as (
  select
    f.org_id,
    f.id as supplier_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', bi.id,
          'org_id', bi.org_id,
          'titulo', bi.titulo,
          'categoria', bi.categoria,
          'status', bi.status,
          'prioridade', bi.prioridade,
          'obra_id', bi.obra_id,
          'obra_nome', case when bi.obra_id is null then null else coalesce(o.nome, 'Obra') end,
          'projeto_id', bi.projeto_id,
          'projeto_nome', case when bi.projeto_id is null then null else coalesce(p.nome, 'Projeto') end,
          'supplier_id', bi.supplier_id,
          'processo_codigo', bi.processo_codigo,
          'orgao_nome', bi.orgao_nome,
          'responsavel_nome', bi.responsavel_nome,
          'responsavel_email', bi.responsavel_email,
          'proxima_acao', bi.proxima_acao,
          'proxima_checagem_em', bi.proxima_checagem_em,
          'reuniao_em', bi.reuniao_em,
          'link_externo', bi.link_externo,
          'descricao', bi.descricao,
          'created_at', bi.created_at,
          'updated_at', bi.updated_at,
          'ultima_atualizacao_em', bi.ultima_atualizacao_em
        )
        order by bi.updated_at desc
      ) filter (where bi.id is not null),
      '[]'::jsonb
    ) as linked_bureaucracy_items,
    count(bi.id) as linked_items_total,
    count(bi.id) filter (
      where bi.status in ('draft', 'pending', 'in_review', 'waiting_external', 'scheduled')
    ) as open_items_total,
    count(bi.id) filter (
      where bi.status in ('draft', 'pending', 'in_review', 'waiting_external', 'scheduled')
        and bi.proxima_checagem_em is not null
        and bi.proxima_checagem_em < (select value from today)
    ) as overdue_count,
    min(bi.proxima_checagem_em) filter (
      where bi.status in ('draft', 'pending', 'in_review', 'waiting_external', 'scheduled')
        and bi.proxima_checagem_em is not null
    ) as next_deadline,
    coalesce(
      sum(
        case bi.status
          when 'draft' then 5
          when 'pending' then 10
          when 'scheduled' then 10
          when 'in_review' then 15
          when 'waiting_external' then 20
          else 0
        end
      ),
      0
    ) as base_score
  from public.fornecedores f
  left join public.burocracia_itens bi
    on bi.org_id = f.org_id
   and bi.supplier_id = f.id
  left join public.obras o
    on o.id = bi.obra_id
  left join public.projetos p
    on p.id = bi.projeto_id
  group by f.org_id, f.id
)
update public.fornecedores f
set supplier_intelligence = jsonb_build_object(
  'linkedBureaucracyItems', s.linked_bureaucracy_items,
  'metrics', jsonb_build_object(
    'supplier_risk_score', least(100, s.base_score + (s.overdue_count * 15)),
    'overdue_count', s.overdue_count,
    'next_deadline', s.next_deadline,
    'linked_items_total', s.linked_items_total,
    'open_items_total', s.open_items_total,
    'risk_state', case when s.overdue_count >= 3 then 'at_risk' else 'clear' end,
    'threshold_reached', (s.overdue_count >= 3)
  )
)
from supplier_snapshots s
where f.org_id = s.org_id
  and f.id = s.supplier_id;
