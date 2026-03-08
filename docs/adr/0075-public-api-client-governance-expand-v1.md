# ADR 0075: Public API Client Governance Expand V1

## Context

`publicApiV1` já possuía clientes internos de API com nome, status, scopes e quota por minuto.

Isso ainda era insuficiente para preparar uma abertura externa real, porque faltavam:

- ownership interno por cliente
- distinção de exposure (`internal_only`, `allowlist`, `beta`, `general_blocked`)
- quota diária
- budget mensal de chamadas

Sem esses campos, a governança continuaria rasa e a readiness da API pública ficaria desalinhada do rollout real.

## Decision

Expandir `public_api_clients` com:

- `exposure`
- `daily_quota`
- `monthly_call_budget`
- `owner_email`

Expandir também:

- tipos compartilhados
- schemas de create/patch
- `GET/POST /api/v1/public-api/clients`
- `PATCH /api/v1/public-api/clients/:id`
- UI interna em `/api-publica`

Sem criar API keys reais, sem credenciais externas e sem abertura pública nesta fase.

## Consequences

- o domínio passa a ter governança mínima de ownership e quotas antes da camada de credenciais
- a preparação para `publicApiV1` fica operacional, não apenas documental
- a abertura externa continua bloqueada até API keys, quotas enforcement e compliance fecharem
