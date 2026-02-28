# Phase 2 Safe Rollout (Pagination + Payload + Approval Compatibility)

## Scope (additive only)
- API list pagination metadata for:
  - `/api/v1/leads`
  - `/api/v1/compras`
  - `/api/v1/transacoes`
  - `/api/v1/projetos`
  - `/api/v1/orcamentos`
- Dashboard SSR payload slimming (`select` fields used by UI + bounded query size).
- DB compatibility migration for `compras.status` check constraint.

## Safety guardrails
- No breaking change in `/api/v1` response envelope.
- Existing `limit` query param kept compatible (`pageSize` also supported).
- Default page remains `1`, default page size remains `50`.
- Rollback path:
  1. disable affected UI module flag if needed,
  2. redeploy,
  3. apply compensating migration only if DB status constraint needs revert.

## Deployment order
1. Merge app code.
2. Validate production app health.
3. Run migration in staging (`dry_run=true` then apply).
4. Run migration in production with manual approval.

## Smoke checklist
- Leads/compras/transacoes/projetos/orcamentos list endpoints:
  - no query params,
  - `?limit=20`,
  - `?page=2&pageSize=20`,
  - with filters (`status`, `obra_id`, `tipo`).
- Confirm `meta` includes `count`, `page`, `pageSize`, `total`, `hasMore`.
- Dashboard loads without JS errors and charts render.
- Approval flow for compras/orçamentos accepts:
  - `Pendente Aprovação Cliente`,
  - `Revisão Cliente`.

## Monitoring (2h)
- `/api/v1/health/ops`
- Sentry client/server error rate
- `/api/v1/*` 5xx and p95
- Approval transitions in portal and compras/orçamentos updates
