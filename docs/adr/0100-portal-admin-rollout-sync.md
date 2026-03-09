# ADR 0100: Portal Admin Rollout Sync

## Context
- Production is running a hotfix branch for `portalAdminV2` client activity.
- `main` does not yet contain that hotfix, which means a future deploy from `main` would regress the live production behavior.
- `health/ops` also does not expose the rollout snapshots for `portalAdminV2` and `obraIntelligenceV1`, which weakens rollout observability for the next core UX promotions.

## Decision
- Sync the `portalAdminV2` client activity hotfix back into `main` as a minimal patch.
- Expose `portalAdminV2Canary` and `obraIntelligenceV1Canary` in `health/ops`.
- Expose the merged Pod B/C feature flags in `health/ops` so rollout telemetry matches the code already present in `main`.

## Consequences
- `main` becomes safe to deploy again without regressing the live `portalAdminV2` path.
- Rollout telemetry for `portalAdminV2` and `obraIntelligenceV1` becomes visible in production before those modules are promoted.
- The patch stays additive and low-risk because it does not introduce new product behavior beyond syncing already-live logic and exposing observability metadata.
