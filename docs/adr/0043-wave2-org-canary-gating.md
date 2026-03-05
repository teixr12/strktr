# ADR 0043: Wave2 Canary por Organizacao (Weather/Map/Logistics)

## Status
Accepted - 2026-03-05

## Context
- Wave2 de obra (weather/map/logistics) foi entregue de forma aditiva, mas o rollout precisava de canary por organizacao para evitar exposicao global imediata.
- Flags existentes eram globais por ambiente (`NEXT_PUBLIC_FF_*`), sem segmentacao por tenant.
- Requisito operacional: manter rollback instantaneo por flag e sem breaking em `/api/v1`.

## Decision
1. Introduzir gate server-side de canary por organizacao para Wave2:
   - `FF_OBRA_WAVE2_CANARY_ORGS` (allowlist CSV)
   - `FF_OBRA_WAVE2_CANARY_PERCENT` (bucket deterministico 0..100)
2. Aplicar gate nos endpoints Wave2:
   - `GET /api/v1/obras/:id/weather`
   - `GET/PATCH /api/v1/obras/:id/location`
   - `POST /api/v1/obras/:id/logistics/estimate`
   - enriquecimento de contexto em `GET /api/v1/obras/:id/alerts`
3. Aplicar o mesmo gate na UI do first-fold de obra via avaliacao server-side, passando booleans para o componente client.
4. Expor snapshot operacional em `GET /api/v1/health/ops`:
   - `rollout.wave2Canary.configured`
   - `rollout.wave2Canary.percent`
   - `rollout.wave2Canary.allowlistCount`

## Consequences
### Positivas
- Rollout por organizacao com blast radius reduzido.
- Rollback rapido (flags globais OFF) sem migracao destrutiva.
- Nenhuma mudanca breaking em contratos existentes.

### Trade-offs
- Mais variaveis de ambiente para operacao de release.
- Requer disciplina de monitoramento por onda antes de promover percentual.

## Rollback
1. Definir flags Wave2 globais como `false`.
2. Definir `FF_OBRA_WAVE2_CANARY_PERCENT=0`.
3. Limpar `FF_OBRA_WAVE2_CANARY_ORGS`.
4. Redeploy.

## References
- `src/server/feature-flags/wave2-canary.ts`
- `src/app/api/v1/obras/[id]/weather/route.ts`
- `src/app/api/v1/obras/[id]/location/route.ts`
- `src/app/api/v1/obras/[id]/logistics/estimate/route.ts`
- `src/app/api/v1/obras/[id]/alerts/route.ts`
- `src/app/(app)/obras/[id]/page.tsx`
- `docs/runbooks/wave2-weather-map-logistics-rollout.md`
