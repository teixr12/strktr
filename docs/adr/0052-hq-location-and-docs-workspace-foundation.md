# ADR-0052: HQ location and docs workspace foundation

## Status
Accepted

## Context
The next post-100% foundation lot adds two cross-domain capabilities without breaking existing flows:

1. Address-first obra intelligence with organization HQ support for weather, map, and logistics.
2. A unified `/docs` workspace over legacy `sops` and `construction-docs`.

Both changes touch protected areas:
- new `/api/v1` routes and expanded existing contracts,
- additive database migration,
- navigation and rollout behavior,
- tenancy audits and smoke coverage.

The platform already uses:
- additive-only schema changes,
- feature-flag rollouts,
- organization-first RLS,
- backward compatibility for `/api/v1`.

## Decision
1. Keep all changes additive and behind feature flags:
   - `NEXT_PUBLIC_FF_OBRA_ADDRESS_UX_V2`
   - `NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1`
   - `NEXT_PUBLIC_FF_CRONOGRAMA_UX_V2`
   - `NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1`
2. Introduce `org_hq_locations` as a new table with org-scoped RLS and expand `obra_geolocations` with address fields, preserving `lat/lng`.
3. Add `GET/PATCH /api/v1/config/org/hq-location` and `GET /api/v1/docs` without removing or renaming any existing route.
4. Keep `/sops` and `/construction-docs/*` live while `/docs` becomes the new unified workspace.
5. Roll out the HQ/location path with the existing Wave2 organization canary and keep docs/cronograma UX flags off until production code is stable.

## Consequences
### Positive
- No breaking API changes.
- Safe migration path for HQ-aware logistics and address-first UX.
- Unified document discovery without forced data migration.
- Explicit operational rollback by flag and redeploy.

### Negative
- Temporary duplication remains between `/docs`, `/sops`, and `/construction-docs`.
- Docs workspace rollout is UX-first; backend convergence is deferred.
- New org-specific HQ behavior adds another table and audit surface.

## Rollout
1. Apply `supabase/migrations/20260305_org_hq_locations_expand.sql`.
2. Deploy with the new flags off.
3. Enable HQ/location path via Wave2 canary.
4. Enable `cronogramaUxV2` and `docsWorkspaceV1` only after stable smoke on production code.

## Rollback
1. Disable:
   - `NEXT_PUBLIC_FF_OBRA_ADDRESS_UX_V2`
   - `NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1`
   - `NEXT_PUBLIC_FF_CRONOGRAMA_UX_V2`
   - `NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1`
2. Redeploy.
3. Keep schema in place; no destructive rollback.
