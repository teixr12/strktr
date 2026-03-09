# 0092 - Portal Admin V2 overdue approvals summary by obra

## Status
Accepted

## Context

`portalAdminV2` ja mostrava atividade por cliente, follow-up de comentarios e aprovacoes recentes por obra. Faltava um resumo operacional claro para responder duas perguntas no primeiro fold:

- quantas aprovacoes pendentes ja estao vencidas
- qual e o proximo SLA pendente da obra

Sem isso, o painel obrigava leitura manual da lista de aprovacoes para descobrir urgencia.

## Decision

Enriquecer o payload existente de overview por obra, sem criar rota nova e sem migration:

- `overduePendingApprovals`
- `nextPendingSlaAt`

Esses campos sao calculados a partir de `aprovacoes_cliente` filtrando:

- `status = 'pendente'`
- `sla_due_at < now()` para vencidas
- menor `sla_due_at` nao nulo para proximo SLA

O painel da obra passa a exibir:

- card dedicado de SLA vencido
- resumo de proximo SLA acima da lista de aprovacoes

## Consequences

Positivas:

- urgencia operacional mais clara no primeiro fold
- nenhuma rota nova
- nenhuma duplicacao de regra entre obra e cliente

Negativas:

- mais duas consultas de count/next due no payload por obra

## Rollback

- reverter o enriquecimento do payload e remover o card/resumo adicional da UI
