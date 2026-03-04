# ADR 0041: Force replay mode for analytics reconciliation cron

- Date: 2026-03-04
- Status: Accepted
- Owners: Platform / Analytics

## Context

`/api/cron/analytics/reconcile` skipped events already marked with `_posthog_reconciled_at`.

In drift-recovery scenarios, this blocked replay of older rows that were marked reconciled but still absent from external analytics windows.

## Decision

Add optional, backward-compatible replay controls to the reconcile endpoint:

1. `force=true` to replay rows even when `_posthog_reconciled_at` exists.
2. `eventType=` filter (comma-separated) constrained to target event allowlist.
3. Response payload now includes:
   - `forceReplay`
   - `targetEvents`
   - `forced` (count of rows replayed despite prior reconcile mark)
4. Persist `_posthog_reconcile_forced=true` marker in payload when force mode is used.

## Consequences

- Positive:
  - Enables deterministic backfill for drift closure without changing route contracts.
  - Keeps default behavior unchanged when `force` is not provided.
- Trade-off:
  - Force replay can re-send already mirrored rows; relies on downstream dedupe via insert identifiers.
- Rollback:
  - Revert this patch and use default non-force reconciliation flow.
