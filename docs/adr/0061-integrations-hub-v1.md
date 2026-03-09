# ADR 0061: Integrations Hub V1

- Status: accepted
- Date: 2026-03-06

## Context

O programa local de 90 dias precisa de um ponto único para diagnosticar integrações sem abrir domínios regulatórios em produção. Já existe `/api/v1/integrations/status`, mas ele é limitado ao status enxuto usado pelo shell.

## Decision

Criar `integrationsHubV1` como domínio read-only atrás de feature flag e canário por organização, com:

- página dedicada `/integracoes`
- rota nova `/api/v1/integrations/hub`
- snapshot de rollout em `health/ops`
- navegação gated server-side no shell principal

## Consequences

- Nenhuma migration nova.
- Nenhuma mudança breaking em `/api/v1`.
- O hub serve como superfície segura para evoluir billing, calendar, docs e webhooks antes de abrir automações ou integrações write-capable.
