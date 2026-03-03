# Analytics Mirror Env Normalization Closeout (2026-03-03)

## Scope

- Normalize env parsing for PostHog mirror on server-side telemetry to prevent false-disabled external analytics when env values contain whitespace/newline.
- Keep all behavior additive and backwards compatible.

## Changed Files

1. `src/lib/telemetry.ts`
2. `src/lib/analytics/adapter.ts`
3. `src/app/api/v1/health/ops/route.ts`
4. `docs/adr/0028-analytics-mirror-env-normalization.md`

## What Changed

- Added `normalizeEnv()` in telemetry, adapter, and health route.
- Server mirror external-flag check now uses normalized parsing.
- PostHog host/key resolution now trims env values before use.
- Health readiness now checks normalized PostHog config and both external analytics env flags.
- Added log line `telemetry.posthog.mirror_skipped_flag_disabled` for easier diagnosis when mirror is off.

## Validation Executed

- `npm run lint` ✅
- `npm run validate:api-contracts` ✅
- `npm run build` ✅
- `npm run test:e2e` ✅ (6 passed, 4 skipped)

## Risk and Rollback

- Risk level: Low/Medium (analytics instrumentation only, no API contract changes).
- Rollback:
  1. Disable external mirror via `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=false`.
  2. Redeploy.
  3. Internal analytics remains source of truth.

## Follow-up

- Keep daily drift audit for `portal_approval_decision` during 7-day watch window.
- Expected outcome: drift warning should reduce once normalized env-based mirror path is active in production.
