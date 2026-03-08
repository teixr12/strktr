# ADR 0095: Super Admin Billing Governance V1

## Status

Accepted

## Context

`superAdminV1` ja mostrava readiness global de superficies, mas ainda nao dava uma leitura cross-tenant real do risco operacional de billing por organizacao.

## Decision

Adicionar `GET /api/v1/super-admin/billing-governance` como surface read-only atras de `superAdminV1`.

Esse endpoint:

- usa service role apenas para leitura interna
- agrega readiness, state, events, providers e plans de billing por organizacao
- calcula `healthy`, `attention` e `blocked`
- explicita blockers e warnings por org

O painel `/super-admin` passa a mostrar:

- contagem total de orgs acompanhadas
- orgs healthy / attention / blocked
- KYC pendente
- past_due
- lista das orgs com maior prioridade

## Consequences

- melhora a governanca interna sem abrir write cross-tenant
- continua bloqueado por flag/canario
- depende de `SUPABASE_SERVICE_ROLE_KEY`; sem ela, o painel se auto-bloqueia com estado explicito
