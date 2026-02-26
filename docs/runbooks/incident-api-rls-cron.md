# Incident Runbook — API, RLS, Cron

## 1. Detect
- Sentry spike by route `/api/v1/*`
- Health endpoint degraded `/api/v1/health/ops`
- User reports forbidden/recursion/schema errors

## 2. Triage
Capture:
- `requestId`
- route + org/user context
- first-seen timestamp
- impacted domain (`obras`, `comercial`, `financeiro`, `portal`)

## 3. Mitigate (fast)
- Disable affected feature flag when available.
- If RLS policy issue: switch to minimal safe policy temporarily.
- If schema drift: apply additive hotfix migration.

## 4. Validate
- Smoke critical flows
- Confirm Sentry error rate drops
- Confirm health endpoint returns `ok` or acceptable degraded state

## 5. Recover
- Prepare permanent fix PR with root-cause summary.
- Add regression test.
- Update ADR/runbook if policy/process changed.
