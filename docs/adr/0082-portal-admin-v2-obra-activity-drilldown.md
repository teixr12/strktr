# 0082 — Portal Admin V2 Obra Activity Drilldown

- Status: Accepted
- Date: 2026-03-06

## Context

`PortalAdminV2` already had:

- overview geral por obra
- wrapper por projeto
- painel dedicado por obra
- configurações, branding e regeneração de convites

The missing operational gap was a read-only drilldown for:

- clientes do portal por obra
- última sessão por cliente
- sessões recentes
- spotlight de clientes que nunca ativaram

This needed to be additive, reuse existing portal tables, and avoid a parallel backend path.

## Decision

Add a new read-only payload and route:

- `GET /api/v1/portal/admin/obras/:obraId/activity`

Back it with a dedicated service built only on:

- `portal_clientes`
- `portal_sessions`

No schema or contract removals are introduced.

## Consequences

### Positive

- Dedicated obra page now exposes client/session activity without touching settings or invite flows.
- Rollback is trivial: disable `portalAdminV2` or remove the route/UI slice without affecting existing portal admin settings.
- Existing data model remains canonical.

### Negative

- Another read path is added to the portal admin surface.
- The drilldown is limited to recent sessions and current summary, not a full audit history.

## Rollout

- Protected by `portalAdminV2`
- `404-safe` when feature/canary is off
- no production rollout change in this slice
