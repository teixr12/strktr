# STRKTR Architecture

## System Overview
STRKTR is a multi-tenant CRM/ERP for construction SMBs built on:
- Next.js App Router + TypeScript
- Supabase (Auth, Postgres, RLS)
- Vercel (deploy + preview)

## Canonical Layers
1. `src/app/api/v1/*`
- Public HTTP contract layer.
- Must return canonical envelope with `requestId`.

2. `src/server/services/*`
- Business orchestration and domain rules.
- No HTTP concerns.

3. `src/server/repositories/*`
- Data access abstraction.
- Supabase queries centralized here when feasible.

4. `src/shared/schemas/*`
- Zod DTO validation for API inputs.

5. `src/shared/types/*`
- Shared domain and contract types.

## Tenant and Permission Model
- Organization-first scoping via `org_id`.
- RLS is mandatory on tenant data tables.
- Permissions enforced by role (`admin`, `manager`, `user`) per domain.

## API Contract
`/api/v1` response envelope:
- success: `{ data, meta, requestId }`
- error: `{ error, requestId }`

`meta` governance keys:
- `contractVersion`
- optional `deprecation`
- optional `flag`

## Migration Strategy
For any structural DB change:
1. Expand schema (additive only)
2. Backfill data idempotently
3. Switch reads/writes
4. Cleanup legacy paths in later cycle

## Rollout Strategy
- Feature flags first
- Canary by organization
- Full rollout only after stable metrics window

## Observability
- Sentry for frontend/backend errors
- Structured logs with `requestId`
- Health endpoint for runtime checks

## Non-Goals (Current Cycle)
- Full architecture rewrite
- Breaking API changes in `v1`
- Direct-to-prod unreviewed hot paths
