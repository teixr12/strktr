# ADR-0024 — Health/Ops Analytics External Readiness Diagnostic

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-03 |
| Builds on | ADR-0011 (Analytics adapter), ADR-0018 (PostHog server mirror) |

## Context

Production analytics drift still reports mismatch for `portal_approval_decision` (internal present, external missing). Existing `/api/v1/health/ops` exposes runtime, Supabase connectivity, version and flags, but does not explicitly show whether external analytics runtime configuration is complete.

This creates blind spots during rollout/canary and increases MTTR when diagnosing telemetry gaps.

## Decision

- Extend `GET /api/v1/health/ops` with an additive operational check:
  - `checks[].name = analytics_external_config`
  - `ok = true` when:
    - external analytics is disabled, or
    - external analytics is enabled and PostHog key + host are configured.
- Extend `flags` payload with:
  - `analyticsExternalReady` (boolean)
- Configuration sources considered by readiness:
  - key: `NEXT_PUBLIC_POSTHOG_KEY` or `POSTHOG_API_KEY`
  - host: `NEXT_PUBLIC_POSTHOG_HOST` or `POSTHOG_HOST`

No secrets are returned; only booleans and generic status messages.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|-------------|
| Keep diagnosis only in logs/Sentry | Slower operational triage; no single health endpoint truth |
| Add a new diagnostics endpoint | Extra surface area and governance overhead for a small additive need |
| Expose env values directly | Security risk; unnecessary for readiness status |

## Consequences

- Faster diagnosis of analytics misconfiguration without exposing sensitive values.
- Better release gate quality for Phase 2/3 operations and rollback drills.
- No contract breakage (additive response fields only).

## Files Changed

- `src/app/api/v1/health/ops/route.ts`
