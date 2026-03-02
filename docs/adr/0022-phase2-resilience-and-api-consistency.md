# ADR-0022: Phase 2 Resilience & API Consistency

## Status
Accepted

## Context
Phase 1 (ADR-0021) delivered optimistic mutations and form validation. Phase 2 addresses resilience gaps and API layer consistency:
- No retry logic for transient server errors (502/503/504)
- Single global error boundary — no route-specific context for users
- Repeated auth boilerplate across 70+ API routes (10-15 lines per handler)
- Error objects lack structured `code` and `status` properties on the client

## Decision

### 2.1 — API Client Retry with Exponential Backoff
Enhanced `requestApi()` in `src/lib/api/client.ts`:
- Retries up to 2 times on transient errors (408, 429, 502, 503, 504)
- Only retries idempotent methods (GET, PUT, DELETE) — never POST/PATCH
- Exponential backoff: 500ms, 1000ms + random jitter
- Network errors (offline, DNS failure) also retried for idempotent methods
- `noRetry` option to disable per-request
- `retry_attempt` tracked in analytics events
- Thrown errors now carry `.code` and `.status` properties

### 2.2 — Route-Level Error Boundaries
Created `RouteError` component (`src/components/ui/route-error.tsx`):
- Reports errors to Sentry via `captureException` with `boundary: 'route-error'` tag
- Accepts `context` (what was being loaded) and `suggestion` (recovery hint)
- Shows error digest reference code when available
- 12 route-specific `error.tsx` files with Portuguese context messages
- Global `error.tsx` updated to use `RouteError` as well

### 2.3 — withApiAuth Adoption
Migrated 6 collection routes to `withApiAuth` helper:
- knowledgebase, equipe, visitas, transacoes, projetos, compras
- `withApiAuth` now accepts `null` permission (auth-only, no domain permission check)
- Removed unused `_routeCtx` parameter (lint fix)
- Eliminates ~12 lines of auth boilerplate per handler (~144 lines total)

### 2.4 — Extended Error Codes
Added `RATE_LIMITED` and `CONFLICT` to `API_ERROR_CODES` for future rate limiting and concurrent edit detection.

## Consequences
- Transient server errors auto-recover without user action (for read operations)
- Users see route-specific error messages instead of generic "Algo deu errado"
- All route errors automatically reported to Sentry
- 6 API routes use consistent auth pattern — template for remaining routes
- Error objects carry structured metadata for client-side handling
