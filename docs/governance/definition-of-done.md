# STRKTR Definition of Done

A ticket is only done when all conditions below are satisfied.

## Engineering
- Code merged via PR (never direct to `main`).
- CI green (`lint`, `build`, contract checks, e2e smoke).
- No secret exposure in diff.

## Product & Contract
- API contract remains backward-compatible or versioned.
- Feature flags applied where rollback is needed.
- User impact verified by smoke scenarios.

## Data & Security
- Migration follows `expand -> backfill -> switch -> cleanup` when applicable.
- RLS/org isolation validated for affected tables/endpoints.
- Critical writes logged with `requestId`.

## Operability
- Rollout + rollback steps documented.
- Monitoring/Sentry touchpoints identified.
- Runbook/docs updated when behavior changes.
