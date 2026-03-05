# ADR 0055: Generic Org Canary Rollout Gating for Post-Launch Modules

## Status
Accepted — March 5, 2026

## Context
- `wave2` and `address/hq` already use org-scoped rollout helpers in production.
- New post-launch modules were still controlled only by boolean env flags:
  - `financeReceiptsV1`
  - `financeReceiptAiV1`
  - `cronogramaUxV2`
  - `docsWorkspaceV1`
- Boolean-only flags are safe as kill switches, but they are not sufficient for staged promotion by organization.
- We need staged rollout for these modules without creating separate one-off gating logic in each domain.
- We also need a safer operator model where a configured canary with `percent=0` means "blocked rollout" instead of silently enabling a module globally.

## Decision
1. Generalize the org rollout helper so it can serve multiple post-launch modules, not only `wave2` and `address/hq`.
2. Keep the boolean feature env as the primary kill switch for each module.
3. Add per-module org canary envs for:
   - `financeReceipts`
   - `financeReceiptAi`
   - `cronogramaUxV2`
   - `docsWorkspace`
4. Apply the same rollout contract across API, server-rendered pages, and navigation:
   - feature `OFF` => module unavailable
   - feature `ON` + org in canary => module available
   - feature `ON` + org outside canary => `404`-safe or hidden
5. Treat a configured canary as authoritative even when `percent=0` or the allowlist is empty.
6. Expose rollout snapshots for these modules in `health/ops` so operations can verify live state before promotion.

## Consequences
- Safer staged rollout for modules that were previously boolean-only.
- Consistent org-scoped behavior between UI, API, and health telemetry.
- Lower risk of accidental global enablement when preparing a rollout.
- Slightly more operational complexity because each module now carries both a kill switch and a canary configuration.
