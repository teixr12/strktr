# Weekly Release Train Runbook

## Cadence
- Weekly release window (fixed day/time).
- Hotfix anytime for P0/P1 incidents.

## Pipeline
1. PR merged with mandatory checks green.
2. Deploy preview.
3. Smoke tests.
4. Canary release for internal org(s).
5. Progressive rollout.

## Required checks
- `npm run lint`
- `npm run build`
- `npm run validate:api-contracts`
- `npm run test:e2e`
- `npm run audit:production`

## Authenticated E2E prerequisites
- GitHub Actions secrets required:
  - `E2E_USER_EMAIL`
  - `E2E_USER_PASSWORD`
  - `E2E_OBRA_ID`
- CI generates `E2E_BEARER_TOKEN` dynamically at runtime (`npm run e2e:token`).

## Canary gates
- Canary window: 60-120 minutes in one pilot organization before general release.
- Error rate by `/api/v1/*` within baseline.
- p95 latency stable on critical routes.
- No critical functional regressions.

## Rollback order
1. Disable related feature flag.
2. If needed, rollback deployment.
3. Trigger incident runbook and post-mortem.
