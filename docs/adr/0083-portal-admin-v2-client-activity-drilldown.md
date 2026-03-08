# 0083 — Portal Admin V2 Client Activity Drilldown

- Status: Accepted
- Date: 2026-03-06

## Context

`PortalAdminV2` already exposed:

- obra overview
- obra activity summary
- project wrapper
- settings, branding and invite regeneration

The next operational gap was client-level detail inside the obra panel:

- sessions by client
- comments authored by the client
- approval decisions made by the client

This needed to stay additive and avoid inflating the initial obra payload.

## Decision

Add a new on-demand route:

- `GET /api/v1/portal/admin/obras/:obraId/clients/:clientId/activity`

The route is:

- read-only
- behind `portalAdminV2`
- `404-safe`
- built only from existing portal tables

The obra UI loads client activity only when the operator explicitly selects a client.

## Consequences

### Positive

- Better operational debugging per client without changing invite/settings flows.
- Lower blast radius because the detail payload is lazy-loaded.
- Rollback remains simple: remove the route/UI slice or disable `portalAdminV2`.

### Negative

- Adds another read path to portal admin.
- Client drilldown depends on live data consistency across sessions, comments and approvals.

## Rollout

- Local-only in this slice
- no production flag change
- no migration required
