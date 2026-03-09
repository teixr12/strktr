# 0093 - Portal Admin V2 operational priority summary

## Status
Accepted

## Context

O overview central do `Portal Admin V2` mostrava branding, clientes e sessoes, mas ainda nao deixava obvia a urgencia operacional por obra. Faltava consolidar no overview:

- approvals pendentes
- approvals vencidas
- clientes aguardando resposta da equipe
- ultima atividade combinada do portal

## Decision

Enriquecer o payload existente de `portal/admin/overview`, sem criar rota nova:

- `pending_approvals`
- `overdue_pending_approvals`
- `clients_awaiting_internal_reply`
- `clients_awaiting_client_reply`
- `latest_portal_activity_at`

O calculo combina dados reais de:

- `portal_sessions`
- `portal_comentarios`
- `aprovacoes_cliente`

## Consequences

Positivas:

- o overview central mostra urgencia real por obra
- o bloco "o que precisa de acao agora" fica mais preciso
- menos necessidade de abrir cada obra para descobrir risco operacional

Negativas:

- mais agregacao em memoria por pagina do overview

## Rollback

- reverter os campos aditivos do payload
- remover os cards extras e voltar ao resumo anterior
