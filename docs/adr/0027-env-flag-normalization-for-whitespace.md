# ADR 0027: Env Flag Normalization for Whitespace

- Status: Accepted
- Date: 2026-03-03
- Deciders: STRKTR Engineering
- Relates to: ADR 0003, ADR 0024, ADR 0026

## Context
- Production health and release marker showed `tableVirtualization=false` after deployment.
- Vercel production env inspection showed `NEXT_PUBLIC_FF_TABLE_VIRTUALIZATION=\"true\\n\"`.
- Existing flag parsing required strict string equality (`=== 'true'`), causing false negatives when env values include whitespace/newlines.

## Decision
- Normalize boolean flag env values using `trim().toLowerCase()` before evaluation.
- Apply normalized parsing in:
  - `src/lib/feature-flags.ts`
  - `src/app/api/v1/health/ops/route.ts`
- Keep semantics unchanged:
  - default-enabled flags still disable only with explicit `false`
  - default-disabled flags still enable only with explicit `true`

## Consequences
- Positive:
  - Prevents runtime regressions from accidental whitespace in environment variables.
  - Aligns health/release diagnostics with effective runtime behavior.
- Tradeoff:
  - Slightly larger parser surface for feature flags.

## Rollback
- Revert parser change commit.
- Optional operational fallback: normalize affected env values in Vercel and redeploy.

## Validation
- `npm run lint`
- `npm run build`
- `npm run validate:api-contracts`
- `npm run test:e2e`
