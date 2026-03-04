# STRKTR Rollback Drill Report — `taskAssignV1`

- GeneratedAt (UTC): 2026-03-04T12:18:34Z
- Environment: production
- Module under drill: `NEXT_PUBLIC_FF_TASK_ASSIGN_V1`
- Objective: validate kill-switch path (`ON -> OFF -> ON`) without regression

## 1) Baseline (before drill)

- Release version: `82787b8da9ff734887070a2a1cac90ce927b84b8`
- Deployment URL: `https://strktr-k142d5ujh-teixr12s-projects.vercel.app` (pre-drill baseline)
- Key flags:
  - `portalAdminV1=true`
  - `obraKpiV1=true`
  - `obraAlertsV1=true`
  - `generalTasksV1=true`
  - `taskAssignV1=true`

## 2) Drill execution

1. Toggle OFF:
   - Removed `NEXT_PUBLIC_FF_TASK_ASSIGN_V1` in production.
   - Redeployed to `https://strktr-32hfd8o2c-teixr12s-projects.vercel.app`.
   - Deployment metadata:
     - id: `dpl_4WRJ7tYbt254v4uQPoUzVYcyhjLH`
     - created: `2026-03-04 09:11:33 -03`
2. Toggle ON (restore):
   - Added `NEXT_PUBLIC_FF_TASK_ASSIGN_V1=true` in production.
   - Redeployed to `https://strktr-p3egfkf14-teixr12s-projects.vercel.app`.
   - Deployment metadata:
     - id: `dpl_AjWYubjTfFFxSJTHoZ7R4oLH12Np`
     - created: `2026-03-04 09:14:10 -03`
     - status: `Ready`

## 3) Post-restore validation

- `ops/release`:
  - `version=82787b8da9ff734887070a2a1cac90ce927b84b8`
  - `deploymentUrl=https://strktr-p3egfkf14-teixr12s-projects.vercel.app`
  - `taskAssignV1=true`
- `health/ops`:
  - `status=ok`
  - checks include `runtime=true`, `supabase_connection=true`, `analytics_external_config=true`
- Protected endpoint smoke (without token):
  - `/api/v1/general-tasks` -> `401 UNAUTHORIZED`
  - `/api/v1/general-tasks/assignees` -> `401 UNAUTHORIZED`
  - `/api/v1/portal/admin/settings` -> `401 UNAUTHORIZED`
  - `/api/v1/obras/:id/kpis` -> `401 UNAUTHORIZED`
  - `/api/v1/obras/:id/alerts` -> `401 UNAUTHORIZED`

## 4) Evidence artifacts

- Production audit:
  - `docs/reports/production-audit-20260304-091651.md`
- Analytics drift:
  - `docs/reports/analytics-drift-20260304-091659.md`
- Analytics capture probe:
  - `docs/reports/analytics-capture-probe-20260304-091706.md`

## 5) TTR (rollback drill)

- OFF deployment creation: `09:11:33 -03`
- Restore deployment creation: `09:14:10 -03`
- Restore verified healthy by audit snapshot at: `09:16:51 -03` (`health/ops` in production audit)
- Measured recovery window (upper bound): **5m18s**

## 6) Result

- Drill result: **PASS**
- Safety objective met:
  - module kill-switch path works
  - no auth regression in protected endpoints
  - production health remained `ok`
- Remaining non-blocking operational gap:
  - analytics external drift still `warn` for `portal_approval_decision` in 24h window
