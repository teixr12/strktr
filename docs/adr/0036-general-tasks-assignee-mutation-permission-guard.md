# ADR 0036: Guard `assignee_user_id` mutation in generic General Tasks PATCH

- Date: 2026-03-04
- Status: Accepted
- Owners: Platform API / Security

## Context

The General Tasks module exposes two update paths:

1. `POST /api/v1/general-tasks/:id/assign` (already protected with `can_manage_team`).
2. `PATCH /api/v1/general-tasks/:id` (generic updates for title/status/priority/etc).

Because `assignee_user_id` is part of the generic PATCH schema, assignee changes could occur through PATCH without the same domain permission gate.

## Decision

Enforce `can_manage_team` inside `PATCH /api/v1/general-tasks/:id` only when an assignee mutation is requested (`assignee_user_id` provided and different from current value).

All other task updates keep existing behavior and permissions unchanged.

## Consequences

- Positive:
  - Closes an authorization bypass for assignment changes.
  - Aligns security behavior between `/assign` and generic PATCH.
  - Preserves API contract and backward compatibility for non-assignment updates.
- Trade-off:
  - Calls that previously changed assignee through PATCH without team-management permission will now receive `403`.
- Rollback:
  - Revert this endpoint-level guard commit; no schema or route changes required.
