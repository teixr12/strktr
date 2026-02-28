# ADR 0011 — Fail-safe Analytics Adapter and Extended Event Taxonomy

- Status: Accepted
- Date: 2026-02-27
- Deciders: STRKTR Engineering

## Context
STRKTR already captures product events internally via `/api/v1/analytics/events`, but Phase 1 required:
1. Provider-agnostic analytics calls on the client (`track/identify/group/page`),
2. optional external analytics (PostHog) without breaking internal telemetry,
3. additive event taxonomy expansion for activation/core/reliability/portal flows.

The implementation could not break existing API contracts, role/tenant behavior, or current dashboards.

## Decision
1. Add a client-side analytics adapter (`src/lib/analytics/adapter.ts`) with fail-safe behavior:
   - internal analytics remains default source of truth,
   - external PostHog is optional and controlled by `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1`,
   - external failures never block product flows.
2. Keep compatibility by preserving legacy events and extending taxonomy additively via shared types:
   - new file `src/shared/types/analytics.ts`.
3. Expand accepted events in `POST /api/v1/analytics/events` without removing legacy types.
4. Emit portal-related product events server-side in portal endpoints to avoid missing telemetry in token-based portal sessions.

## Consequences
### Positive
- Unified analytics API for current and future providers.
- Safe dual-write path (internal + optional external) with rollback by flag.
- Better observability coverage for dashboard/leads/obras/portal actions.

### Negative
- Slightly larger event vocabulary to govern.
- Potential temporary duplicate semantics while migrating older event consumers.

## Rollout / Rollback
- Rollout:
  1. deploy with `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=false`,
  2. validate internal events and UX flows,
  3. enable external provider in pilot, compare deltas.
- Rollback:
  1. set `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=false`,
  2. keep internal analytics path active,
  3. no DB rollback required.
