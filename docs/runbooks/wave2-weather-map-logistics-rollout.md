# Wave2 Rollout Runbook (Weather + Map + Logistics)

## Scope
- Module: `Wave2 Obra Signals`
- UI: obra detalhe (`Clima, Mapa e Logistica`)
- API:
  - `/api/v1/obras/:id/location`
  - `/api/v1/obras/:id/weather`
  - `/api/v1/obras/:id/logistics/estimate`
  - `/api/v1/obras/:id/alerts` (context enrichment)

## Flags (global gate)
- `NEXT_PUBLIC_FF_OBRA_WEATHER_V1`
- `NEXT_PUBLIC_FF_OBRA_MAP_V1`
- `NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1`
- `NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1`

## Canary by org (server-side)
- `FF_OBRA_WAVE2_CANARY_ORGS`:
  - CSV with explicit `org_id` allowlist.
- `FF_OBRA_WAVE2_CANARY_PERCENT`:
  - Integer `0..100` for deterministic org bucketing.

When canary config is present (`allowlist` or `percent > 0`), Wave2 APIs/UI are available only for matching orgs.

## Preconditions
1. Migration applied:
   - `supabase/migrations/20260305_obra_geolocations_expand.sql`
2. CI green:
   - `npm run lint`
   - `npm run build`
   - `npm run validate:api-contracts`
   - `npm run test:e2e`
   - `npm run governance:all`

## Enablement Steps
1. Keep all Wave2 flags `false`.
2. Set canary orgs:
   - `FF_OBRA_WAVE2_CANARY_ORGS=<orgA>,<orgB>,...`
3. Enable only needed module flags:
   - Start with `NEXT_PUBLIC_FF_OBRA_MAP_V1=true`
   - Then `NEXT_PUBLIC_FF_OBRA_WEATHER_V1=true`
   - Then `NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1=true`
4. Enable weather-alert enrichment last:
   - `NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1=true`
5. Redeploy and monitor for 2-4h.

## Progressive Expansion
1. `FF_OBRA_WAVE2_CANARY_PERCENT=5`
2. `FF_OBRA_WAVE2_CANARY_PERCENT=25`
3. `FF_OBRA_WAVE2_CANARY_PERCENT=100`
4. Optional: clear allowlist after 100%.

## Monitoring
1. `/api/v1/health/ops`:
   - `status=ok`
   - `rollout.wave2Canary` snapshot
2. 5xx on Wave2 routes.
3. JS errors on obra detail.
4. Analytics:
   - drift report `<5%`
   - capture probe `pass`

## Rollback
1. Module rollback:
   - set corresponding `NEXT_PUBLIC_FF_OBRA_*` flag to `false`
2. Canary rollback:
   - set `FF_OBRA_WAVE2_CANARY_PERCENT=0`
   - clear `FF_OBRA_WAVE2_CANARY_ORGS`
3. Redeploy.
4. Keep migration in place (additive; no destructive rollback).
