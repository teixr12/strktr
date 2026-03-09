# 0062 — Public API V1 Foundation

- Date: 2026-03-06
- Status: accepted

## Context

A STRKTR já possui uma superfície interna ampla em `/api/v1`, mas ainda não existe produto de API pública com API keys, quotas, docs versionadas e gate mínimo de compliance para terceiros.

Abrir essa superfície sem readiness explícito criaria risco alto em financeiro, documentos e operações.

## Decision

Criar `publicApiV1` como fundação read-only, atrás de `feature flag + canário por organização`, com:

1. `GET /api/v1/public-api/readiness` protegido e `404-safe` fora do rollout.
2. Página interna `/api-publica` para readiness operacional.
3. Catálogo de superfícies internas candidatas a exposição externa.
4. Checklist explícito de bloqueios para general release:
   - API keys
   - rate limit distribuído
   - webhook signing
   - docs externas versionadas

## Consequences

- O domínio pode evoluir sem gerar API keys fake ou interfaces enganosas.
- O rollout permanece controlado e observável.
- A abertura geral continua bloqueada até o gate mínimo de compliance fechar.
