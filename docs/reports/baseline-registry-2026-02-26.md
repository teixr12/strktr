# STRKTR Baseline Registry — 2026-02-26

## Baseline Inventory
- Snapshot report: `docs/reports/baseline-20260226-060700.md`
- Branch: `codex/baseline-stabilization-20260226`
- Strategy: commit único rastreável + tag de baseline

## Local Readiness (latest)
Executed via:
`ALLOW_BIND_RESTRICTED_E2E_SKIP=1 npm run release:readiness`

Results:
- Lint: pass
- Build: pass
- API contract checks: pass
- E2E smoke: bind-restricted skip (documented fallback), no test assertion failures observed in this environment

## Production Audit (latest)
- Report: `docs/reports/production-audit-20260226-060709.md`
- Health: `ok`
- Migrations audit: `ok`
- RLS audit: `ok`
- org_id null audit: `ok`

## Operational Notes
- This baseline consolidates governance + runbooks + audit tooling.
- Next step after baseline tag: activate GitHub branch protection and Projects workflow.
