# 0080 — Public API Token Quota Preview V1

## Context

`publicApiV1` ja possui governanca interna por cliente, tokens internos e preview de uso/quota por cliente.
O proximo passo seguro era expor visibilidade equivalente por token sem abrir quota override, autenticação third-party real ou enforcement write-capable.

## Decision

Implementar um preview interno e read-only de quota por token:

- cada token herda a quota efetiva do cliente
- o uso do token e calculado a partir de `public_api_client_usage_events.token_id`
- o status de quota do token reutiliza a mesma politica do cliente
- o detalhe de atividade por token fica disponivel via endpoint autenticado dedicado

## Why

- melhora a governanca antes de abrir a API publica
- reduz risco porque nao introduz billing, revogacao automatica ou override por token
- preserva o contrato atual de cliente como fonte de verdade de quota

## Consequences

- `GET /api/v1/public-api/clients/:id/tokens` passa a retornar tambem:
  - `effective_quota`
  - `usage`
  - `quota_status`
- novo endpoint:
  - `GET /api/v1/public-api/clients/:id/tokens/:tokenId/usage`
- continua sem escrita nova de quota por token
- continua `404-safe` atras de `publicApiV1` + canario por org
