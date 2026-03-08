# Program Rollout: 100% in Everything (90-Day Program)

## Objective
- Start all approved workstreams now without opening uncontrolled blast radius in production.
- Promote only one risky production module at a time.
- Keep the whole program observable from code, not only from planning docs.

## Control Plane
1. Kill switch:
   - `NEXT_PUBLIC_FF_*`
2. Org canary:
   - `FF_*_CANARY_ORGS`
   - `FF_*_CANARY_PERCENT`
3. Observability:
   - `GET /api/v1/health/ops`
   - `GET /api/v1/ops/release`
   - `GET /api/v1/ops/program`

## Pod Order
1. Pod A
   - `financeReceipts`
   - `financeReceiptAi`
   - `cronogramaUxV2`
   - `docsWorkspace`
2. Pod B
   - `portalAdminV2`
   - `obraIntelligenceV1`
   - `financeDepthV1`
   - `supplierManagementV1`
   - `bureaucracyV1`
   - `emailTriageV1`
3. Pod C
   - `billingV1`
   - `referralV1`
   - `publicApiV1`
   - `integrationsHubV1`
   - `superAdminV1`
   - `agentReadyV1`
   - `bigDataV1`
   - `openBankingV1`

## Promotion Rules
1. Production promotion is sequential by risky module.
2. Default sequence:
   - allowlist QA
   - `25%`
   - `100%`
3. Regulated domains may be implemented in parallel but cannot open for general release until:
   - RBAC/RLS
   - rate limit
   - audit log
   - secret rotation/signature
   - rollback path
   - consent/terms where applicable

## Mandatory Checks
- `npm run lint`
- `npm run build`
- `npm run validate:api-contracts`
- `npm run test:e2e`
- `npm run governance:all`
- `./scripts/run-production-audits.sh`
- `./scripts/audit-analytics-drift.sh`
- `./scripts/audit-analytics-capture-probe.sh`

## Rollback
1. Set the module boolean flag to `false`.
2. If needed, keep the flag `true` and force `percent=0`.
3. Redeploy.
4. Recheck:
   - `health/ops`
   - `ops/release`
   - targeted smoke flow
