# Core Operational Closeout

## Objective
Close the live core with explicit production evidence, rollback proof, and release traceability before opening the remaining Pod B and Pod C modules.

## Preconditions
1. `Wave2`, `financeReceipts`, `financeReceiptAi`, `cronogramaUxV2`, `docsWorkspaceV1`, `portalAdminV2`, and `obraIntelligenceV1` are all live.
2. `npm run test:e2e:strict:auth` is green in CI.
3. `GET /api/v1/health/ops` and `GET /api/v1/ops/release` show the live SHA and `branch=main`.

## Required Rollback Drills
Run and complete all:
1. `npm run ops:finance-receipt-ai:rollback-drill`
2. `npm run ops:cronograma-ux-v2:rollback-drill`
3. `npm run ops:docs-workspace:rollback-drill`
4. `npm run ops:portal-admin-v2:rollback-drill`
5. `npm run ops:obra-intelligence-v1:rollback-drill`

For each drill:
1. Capture the baseline health snapshot.
2. Toggle the module OFF using canary percent `0` or the global flag.
3. Redeploy from the clean worktree only.
4. Run the validator before and after the OFF transition.
5. Restore the module to `100%`.
6. Record TTR and attach validator evidence.

## Final Evidence
1. `./scripts/run-production-audits.sh`
2. `./scripts/audit-analytics-drift.sh`
3. `./scripts/audit-analytics-capture-probe.sh`
4. `node scripts/generate-core-operational-closeout.mjs`

## Acceptance
- `health/ops=ok`
- `ops/release` matches the live SHA
- auth strict is an official gate
- rollback drill reports exist for every core live module
- no drift/probe regression beyond policy
- closeout report is attached to release evidence
