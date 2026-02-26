## Summary
- What changed?
- Why now?

## Scope
- [ ] Backend API
- [ ] Frontend UI
- [ ] Database migration
- [ ] Infra/CI
- [ ] Docs/Runbook

## Risk Level
- [ ] Low
- [ ] Medium
- [ ] High

## Contract Impact
- [ ] No `/api/v1` contract change
- [ ] Backward-compatible contract extension
- [ ] Breaking change (requires `/api/v2` plan)

If contract changed, describe fields/endpoints:

## Data & Migration
- [ ] No migration
- [ ] Additive migration only
- [ ] Backfill required
- [ ] Cleanup phase planned

Migration strategy (`expand -> backfill -> switch -> cleanup`):

## Feature Flags
- [ ] Not required
- [ ] Required and added

Flag key(s) and default state:

## Testing
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run validate:api-contracts`
- [ ] `npm run test:e2e`
- [ ] Manual smoke

## Rollout
- Canary org(s):
- Metrics to watch:
- Estimated rollout window:

## Rollback
- Flag-off path:
- Data rollback path (if any):

## Checklist
- [ ] Docs updated
- [ ] ADR added/updated (if architectural change)
- [ ] Security impact reviewed
