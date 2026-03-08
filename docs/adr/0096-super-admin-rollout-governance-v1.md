# ADR 0096: Super Admin Rollout Governance V1

## Status

Accepted

## Context

O programa de rollout ja tinha registro central em `ops/program`, mas o `superAdminV1` ainda nao mostrava essa governanca dentro do painel global.

## Decision

Adicionar `GET /api/v1/super-admin/rollout-governance` como surface read-only atras de `superAdminV1`.

Esse endpoint:

- reutiliza o `program-status` existente
- agrega rollout por modulo, pod, risco e gate de compliance
- destaca o que esta `blocked`, `off`, `allowlist`, `canary` e `live`

O painel `/super-admin` passa a mostrar:

- resumo de rollout por dominio
- modulos com maior prioridade operacional
- quantos modulos regulados ainda nao estao live

## Consequences

- melhora a leitura executiva do programa inteiro
- nao abre write nem deploy cross-tenant
- preserva o rollout atual de producao
