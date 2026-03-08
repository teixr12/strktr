# ADR 0090 — Portal Admin V2 Follow-up State by Client

## Context

`portalAdminV2` ja mostrava sessoes, comentarios, decisoes e pendencias por cliente, mas ainda faltava uma leitura operacional simples de "quem esta com a vez".

Sem isso, o time precisa ler manualmente o comentario mais recente para descobrir:

- se a equipe interna precisa responder
- se o cliente precisa responder
- quais clientes estao parados sem follow-up claro

## Decision

Calcular `follow_up_state` de forma read-only usando apenas o comentario mais recente de cada cliente:

- ultimo comentario `cliente` => `awaiting_internal`
- ultimo comentario `interno` => `awaiting_client`
- sem comentario => `idle`

O estado entra:

- no payload agregado da obra
- no payload detalhado do cliente
- na UI de lista de clientes e no drilldown selecionado

## Consequences

Positivas:

- melhora priorizacao operacional sem criar workflow novo
- usa apenas dados reais ja existentes
- nao exige migration nem altera contratos legados do portal

Negativas:

- e uma heuristica simples; nao substitui thread model completo
- nao distingue contexto por assunto ou aprovacao individual

## Rollback

- manter `portalAdminV2` desligado em producao
- o slice nao altera settings, invites, comentarios ou aprovacoes existentes
