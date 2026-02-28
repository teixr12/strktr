# ADR 0013 — Default ON for Trust-Critical UI Flags

- Status: Accepted
- Date: 2026-02-28
- Deciders: STRKTR Engineering

## Context
Production health showed trust-critical UX features still disabled due to environment drift:
- `profileAvatarV2`
- `navCountsV2`
- `leadsProgressV2`
- `orcamentoPdfV2`

These features were already implemented, validated, and expected to be active for end users.

## Decision
Change these four flags to **default enabled** (`!== 'false'`) in:
- `src/lib/feature-flags.ts`
- `src/app/api/v1/health/ops/route.ts`

This preserves kill-switch behavior because each flag can still be disabled explicitly with `false`.

## Consequences
### Positive
- Removes dependency on environment-only activation for core UX confidence features.
- Prevents silent regressions from missing or drifted env vars.

### Negative / Tradeoffs
- Requires explicit env `false` to keep a module disabled.

## Rollout / Rollback
- Rollout: merge and deploy normally on `main`.
- Rollback:
  1. set any impacted flag to `false`,
  2. redeploy,
  3. if needed, revert commit.
