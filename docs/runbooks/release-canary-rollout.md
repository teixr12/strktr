# Release Runbook — Canary by Organization

## Pre-conditions
- CI green
- PR approved
- Feature flag exists for risky scope

## Rollout stages
1. **Stage A**: deploy with flag OFF.
2. **Stage B**: enable flag for internal org(s).
3. **Stage C**: monitor 60-120 min (errors, p95, functional smoke).
4. **Stage D**: progressive enablement for more orgs.

## Rollback criteria
- Critical error spike above threshold
- Core flow regression (obras/leads/financeiro)
- Tenant isolation risk

## Rollback action
- Disable module flag first.
- If needed, revert deployment.
- Keep schema additive (no destructive rollback).
