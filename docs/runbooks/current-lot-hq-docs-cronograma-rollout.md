# Current Lot Rollout: HQ + Address-First + Docs Workspace + Cronograma UX V2

## Scope
- `NEXT_PUBLIC_FF_OBRA_ADDRESS_UX_V2`
- `NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1`
- `NEXT_PUBLIC_FF_CRONOGRAMA_UX_V2`
- `NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1`

## Preconditions
1. Apply migration `supabase/migrations/20260305_org_hq_locations_expand.sql`.
2. Deploy production with all four flags set to `false`.
3. Confirm:
   - `npm run release:readiness`
   - `health/ops=ok`
   - `/api/v1/docs` returns `404` with flag off

## Canary
1. Keep `NEXT_PUBLIC_FF_OBRA_ADDRESS_UX_V2=true` and `NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1=true`.
2. Keep `NEXT_PUBLIC_FF_CRONOGRAMA_UX_V2=false` and `NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1=false` until Wave2 smoke is stable.
3. Keep `FF_OBRA_WAVE2_CANARY_PERCENT=100` to preserve already-live weather/map/logistics rollout.
4. Set `FF_OBRA_ADDRESS_HQ_CANARY_PERCENT=5`.
5. Redeploy and validate:
   - obra detail
   - weather/map/logistics
   - HQ config
6. Increase `FF_OBRA_ADDRESS_HQ_CANARY_PERCENT=25`.
7. Redeploy and repeat smoke.
8. Set `FF_OBRA_ADDRESS_HQ_CANARY_PERCENT=100`.

## Global UX Enablement
1. Set `NEXT_PUBLIC_FF_CRONOGRAMA_UX_V2=true`.
2. Set `NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1=true`.
3. Redeploy.
4. Validate:
   - `/docs`
   - `/sops`
   - `/construction-docs/projects`
   - cronograma list/timeline/calendar/board

## Rollback
1. Set `NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1=false`.
2. Set `NEXT_PUBLIC_FF_CRONOGRAMA_UX_V2=false`.
3. Set `NEXT_PUBLIC_FF_OBRA_ADDRESS_UX_V2=false`.
4. Set `NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1=false`.
5. Set `FF_OBRA_ADDRESS_HQ_CANARY_PERCENT=0`.
6. Redeploy.

## Smoke Checklist
- login/dashboard
- obra detail
- obra weather/map/logistics
- cronograma recalculate/pdf
- `/docs`
- `/sops`
- `/construction-docs/projects`
- `health/ops`
