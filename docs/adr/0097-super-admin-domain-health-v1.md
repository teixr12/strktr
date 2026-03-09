# ADR 0097: Super Admin Domain Health V1

## Status

Accepted

## Context

`superAdminV1` ja mostrava readiness global, billing governance e rollout governance, mas ainda faltava uma leitura executiva unica da saude operacional por dominio.

## Decision

Adicionar `GET /api/v1/super-admin/domain-health` como surface read-only atras de `superAdminV1`.

Esse endpoint:

- usa a mesma base de sinais de `health/ops`
- reutiliza o `program-status`
- agrupa a leitura em dominios operacionais:
  - plataforma base
  - analytics e observabilidade
  - pod A
  - pod B
  - pod C

## Consequences

- melhora a leitura executiva sem duplicar rollout ou abrir write
- preserva isolamento e o rollout atual de producao
- cria um ponto unico para priorizacao operacional interna
