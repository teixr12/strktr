# ADR 0079: Public API Quota Enforcement Preview V1

## Status
Accepted

## Context
`publicApiV1` já possui readiness, governança de clientes, tokens internos e trilha de uso. Faltava a camada de avaliação de quotas para saber quando um cliente seria bloqueado por `rate_limit_per_minute`, `daily_quota` ou `monthly_call_budget`.

## Decision
- Calcular `quota_status` internamente a partir dos eventos de uso já persistidos.
- Expandir:
  - `GET /api/v1/public-api/clients`
  - `GET /api/v1/public-api/clients/:id/usage`
- Expor:
  - uso do minuto atual
  - saldo de rate limit
  - status `healthy | warning | blocked_*`
  - `would_block`
  - motivos da decisão

## Consequences
- O produto ganha uma prévia real de enforcement sem abrir autenticação third-party.
- O mesmo cálculo pode ser reaproveitado depois no gateway real da API pública.
- Não há escrita nova nem mudança breaking de contrato.
