# ADR 0078: Public API Client Usage Foundation V1

## Status
Accepted

## Context
`publicApiV1` já possui readiness, governança de clientes e inventário interno de tokens. O próximo passo seguro é adicionar visibilidade de consumo por cliente sem abrir autenticação third-party nem escrita externa.

## Decision
- Adicionar `public_api_client_usage_events` como trilha aditiva de uso por cliente/token.
- Expor leitura agregada em:
  - `GET /api/v1/public-api/clients`
  - `GET /api/v1/public-api/clients/:id/usage`
- Manter tudo atrás de `publicApiV1` + canário por org.
- Não adicionar endpoint de ingestão pública nesta fase.

## Consequences
- O workspace de API pública passa a mostrar quota diária/mensal, saldo e última atividade por cliente.
- A fundação fica pronta para enforcement de quotas e analytics operacionais depois.
- Não há quebra de contrato existente; apenas expansão aditiva com o campo opcional `usage`.
