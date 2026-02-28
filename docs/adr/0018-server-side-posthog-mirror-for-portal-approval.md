# 0018 — Server-side PostHog mirror for portal approval events

- Status: Accepted
- Date: 2026-02-28

## Context

During Phase 2 closeout, analytics drift showed missing external events for `portal_approval_decision` while internal product events were correctly persisted in `eventos_produto`.

Portal approval/rejection is primarily a server-side action (`/api/v1/portal/aprovacoes/[id]/approve` and `/reject`). Client-side capture can be blocked/intermittent in public portal contexts.

## Decision

Add an optional server-side PostHog mirror in `emitProductEvent` and enable it only for portal approval decision events from the two portal approval routes.

Implementation constraints:

- Keep internal analytics as source of truth.
- Keep fail-safe behavior: external failures must never break runtime.
- Keep `/api/v1` contracts unchanged.
- Avoid global duplication: no broad mirror for all events.

## Consequences

Positive:

- Reduces drift for `portal_approval_decision`.
- Improves reliability of external analytics under client capture instability.

Neutral/Trade-off:

- Adds a small server-side network call in approval routes (best-effort, swallowed failures).
- External event parity still monitored by daily drift report.

## Rollback

1. Disable external analytics flag: `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=false`.
2. Remove `mirrorExternal: true` from portal approval routes if needed.
3. Keep internal analytics unchanged in all cases.
