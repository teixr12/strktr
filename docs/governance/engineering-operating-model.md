# Engineering Operating Model

## Cadence
- Weekly release train
- Immediate hotfix branch for critical incidents

## Delivery flow
1. Plan issue with acceptance criteria
2. Implement in `codex/*` branch
3. Open PR with rollout/rollback
4. Pass CI + approvals
5. Canary rollout via feature flags
6. Promote to production

## WIP and SLAs
- Max 2 concurrent in-progress items per engineer.
- PR first review SLA: 24h.
- High-risk PR review SLA: same day.

## Quality gates
- API contract checks mandatory
- E2E smoke mandatory for release candidates
- Security checks mandatory on PR

## Incident classes
- P0: production down / tenant breach risk
- P1: critical workflow broken
- P2: degraded functionality with workaround
- P3: non-critical defect
