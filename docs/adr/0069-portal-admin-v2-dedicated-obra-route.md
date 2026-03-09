# ADR 0069: Portal Admin V2 Dedicated Obra Route

- Status: accepted
- Date: 2026-03-06

## Context

`portalAdminV2` already had an overview page and a richer portal admin tab inside each obra. The missing piece was a dedicated, stable route for operating the portal domain directly without forcing users through the obra detail tabs every time.

## Decision

Add a dedicated route at `/portal-admin/[obraId]` that:

- reuses the existing portal admin settings/session backend
- reuses the existing `ObraPortalAdminTab` as the functional core
- is gated by `portalAdminV2` + org canary
- keeps `/obras/[id]` tab access intact as compatibility

The overview page now links primarily to the dedicated portal admin route and secondarily to the obra detail page.

## Consequences

Positive:

- Improves navigation and task focus for the portal domain without changing API contracts.
- Preserves compatibility because the obra tab remains live.
- Keeps blast radius low by reusing existing backend and client logic.

Tradeoffs:

- The domain still depends on the existing settings/session APIs and does not yet have a separate detail API layer.
- Project-level routing is still future work; this phase focuses on obra-level administration.
