# Construction Docs Rollout Runbook (Safe, Additive)

## Scope
- Module: `construction-docs`
- UI: `/construction-docs/*`, `/portal/construction-docs/[token]`
- API: `/api/v1/construction-docs/*`
- Gate: `FEATURE_CONSTRUCTION_DOCS` (or `NEXT_PUBLIC_FF_CONSTRUCTION_DOCS_V1`)

## Preconditions
1. Apply migration:
   - `supabase/migrations/20260304_construction_docs_expand.sql`
2. Keep flag OFF in production.
3. CI green on branch:
   - `npm run lint`
   - `npm run build`
   - `npm run validate:api-contracts`
   - `npm run test:e2e`

## Validation With Flag OFF
1. `GET /api/v1/health/ops` shows `flags.constructionDocs=false`.
2. Protected endpoints return `404` safe envelope:
   - `/api/v1/construction-docs/templates`
   - `/api/v1/construction-docs/projects/:projectId/visits`
3. Public share endpoint returns `404` for invalid token.
4. Sidebar and command palette do not show Construction Docs entry.

## Enablement (Big-Bang Wave)
1. Set env:
   - `FEATURE_CONSTRUCTION_DOCS=true`
2. Redeploy.
3. Confirm `health/ops` flag turned `true`.
4. Run smoke:
   - Open `/construction-docs/templates`
   - Create template
   - Open `/construction-docs/projects/:projectId`
   - Create visit and upload photo
   - Generate inspection document
   - Export PDF + CSV
   - Create share link and validate `/portal/construction-docs/:token`

## Monitoring (first 2-4h)
1. `health/ops` must stay `ok`.
2. 5xx rate on `/api/v1/construction-docs/*`.
3. JS errors on construction-docs pages.
4. p95 for `templates`, `projects/:id`, `documents/:id`.

## Rollback
1. Set `FEATURE_CONSTRUCTION_DOCS=false`.
2. Redeploy.
3. Re-check:
   - `health/ops` flag false
   - `/api/v1/construction-docs/*` protected endpoints return 404-safe
4. Keep migration in place (additive schema, no destructive rollback).

## Notes
- Internal analytics remains source of truth.
- External analytics drift does not block module rollback safety.
