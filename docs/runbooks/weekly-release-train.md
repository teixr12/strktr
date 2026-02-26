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

## Canary gates
- Error rate by `/api/v1/*` within baseline.
- p95 latency stable on critical routes.
- No critical functional regressions.

## Rollback order
1. Disable related feature flag.
2. If needed, rollback deployment.
3. Trigger incident runbook and post-mortem.
