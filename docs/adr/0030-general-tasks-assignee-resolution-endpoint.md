# ADR 0030: General Tasks Assignee Resolution Endpoint

- Status: Accepted
- Date: 2026-03-03

## Context

Wave1 introduced `general_tasks` with assignment support, but UI assignment required a reliable list of active org members. Existing member APIs are permission-scoped to team management and are not ideal for lightweight assignment UX in shared operational flows.

We need an additive, tenancy-safe way to resolve assignable users without changing existing contracts or weakening RBAC/RLS.

## Decision

1. Add additive endpoint `GET /api/v1/general-tasks/assignees`.
2. Resolve candidates from `org_membros (status=ativo)` scoped by `org_id`, then enrich with `profiles (nome, email)`.
3. Keep endpoint authentication org-scoped through existing `getApiUser` guard.
4. Keep assignment execution behavior backward-compatible:
   - use `POST /api/v1/general-tasks/:id/assign` when `taskAssignV1` is enabled,
   - fallback to `PATCH /api/v1/general-tasks/:id` for null/unassign flows.

## Consequences

1. Assignment UX becomes complete without depending on broader team-management endpoints.
2. No breaking change in `/api/v1`; existing flows remain unchanged.
3. Multi-tenant isolation stays enforced by org-scoped queries and table RLS.

## Rollback

1. Disable `NEXT_PUBLIC_FF_TASK_ASSIGN_V1` and/or `NEXT_PUBLIC_FF_GENERAL_TASKS_V1`.
2. Redeploy.
3. Existing task CRUD remains operational through original endpoints.
