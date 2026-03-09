# ADR 0087 — Portal Admin V2 client SLA and pending approval drilldown

## Status
Accepted — 2026-03-06

## Context
- `portalAdminV2` already exposed:
  - obra overview
  - obra activity
  - client activity with sessions, comments and past decisions
- It still lacked a direct read of pending approvals assigned to a specific portal client.
- That made the drilldown incomplete for support and operations because admins could not see:
  - how many pending approvals are currently assigned to the client
  - whether any assigned SLA is already overdue
  - which pending approvals need action next

## Decision
- Extend the existing client activity payload.
- Reuse `aprovacoes_cliente.portal_cliente_id` and `sla_due_at`.
- Add:
  - `pendingAssignedApprovals`
  - `overduePendingApprovals`
  - `nextPendingSlaAt`
  - `recentPendingApprovals`
- Keep the route and domain:
  - read-only
  - behind `portalAdminV2`
  - `404-safe` outside rollout

## Consequences
- Portal Admin becomes operationally useful for follow-up by client, not only retrospective.
- No new write path was introduced.
- No migration was needed because the required data already existed.
