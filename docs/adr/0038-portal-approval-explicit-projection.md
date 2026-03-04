# ADR 0038: Explicit projection on portal approval decision updates

- Date: 2026-03-04
- Status: Accepted
- Owners: API Platform / Portal Domain

## Context

`POST /api/v1/portal/aprovacoes/:id/approve` and `POST /api/v1/portal/aprovacoes/:id/reject` updated approval rows using `.select('*')`.

Wildcard projections increase payload drift risk as schema evolves, and make contract/performance governance less predictable.

## Decision

Keep existing endpoint routes and response shape unchanged, and replace wildcard selection with explicit approved columns for `data.aprovacao`:

1. `id`, `org_id`, `obra_id`, `tipo`, `compra_id`, `orcamento_id`
2. `status`, `solicitado_por`, `solicitado_em`
3. `decidido_por_portal_cliente_id`, `decisao_comentario`, `decidido_em`
4. `approval_version`, `predecessor_aprovacao_id`, `sla_due_at`, `sla_alert_sent_at`

## Consequences

- Positive:
  - More stable API payload contract for portal decision endpoints.
  - Lower over-fetch risk on approval updates.
  - No route/field rename and no migration required.
- Trade-off:
  - New approval columns added in the future require explicit opt-in in this projection.
- Rollback:
  - Revert projection constants to previous wildcard select behavior if needed.
