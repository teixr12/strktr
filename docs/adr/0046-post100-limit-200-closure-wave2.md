# ADR 0046 — Post-100 performance hardening: limit(200) closure (Wave2)

- Date: 2026-03-05
- Status: Accepted

## Context

After Wave2 reached full rollout in production, `limit(200)` remained in critical alert and agenda paths.
These routes are high-frequency and mostly compute aggregates or truncated task lists, so hard caps of 200 were creating unnecessary payload pressure without user-visible benefit.

The architecture guardrails remain unchanged:

1. Additive changes only.
2. `/api/v1` backward-compatible.
3. No destructive schema changes.

## Decision

1. Replace urgent purchases alert fetch with count-only query:
   - `select('id', { count: 'exact', head: true })`
   - removes row payload transfer when only total is needed.
2. Reduce delayed cronograma scan limit in architect agenda:
   - from `200` to `120`
   - endpoint already slices final payload to top `80`.
3. Reduce rejected SLA scan limit in daily alerts cron:
   - from `200` to `120`
4. Tighten governance budget:
   - `limit-200` rule reduced from `14` to `11`.

## Consequences

### Positive

1. Lower memory and transfer overhead in hot operational routes.
2. Better consistency between budget policy and real codebase state.
3. Preserves existing contracts and response shapes.

### Trade-offs

1. Alert cron scans fewer rejected-SLA rows per run by default; this is acceptable for daily batching and can be increased if needed.
2. Agenda scans fewer delayed cronograma items, but still exceeds final visible cap.

## Rollback

1. Restore previous limits (`200`) in affected routes.
2. Raise `limit-200` governance budget back to previous value (`14`) if emergency compatibility requires temporary relaxation.

