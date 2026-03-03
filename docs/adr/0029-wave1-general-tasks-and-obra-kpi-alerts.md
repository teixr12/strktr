# ADR 0029: Wave1 General Tasks and Obra KPI/Alerts Additive Expansion

- Status: Accepted
- Date: 2026-03-03

## Context

Wave1 requires delivering operational value in core flows without breaking existing contracts:

1. Company-level tasks not tied to a specific project (`general_tasks`).
2. Obra-first prioritization in detail views through explicit KPI and alert endpoints.
3. Full compatibility with existing `/api/v1` consumers, multi-tenant RLS, and rollback-by-flag.

The current platform already enforces org-first tenancy and feature-flag controlled rollout. New domain additions must follow the same model and avoid destructive schema/API changes.

## Decision

1. Add a new additive table `public.general_tasks` with:
   - `org_id`-scoped RLS policies,
   - indexes for board/list use cases,
   - no destructive migration behavior.
2. Introduce additive `/api/v1` endpoints:
   - `GET/POST /api/v1/general-tasks`
   - `PATCH/DELETE /api/v1/general-tasks/:id`
   - `POST /api/v1/general-tasks/:id/assign`
   - `GET /api/v1/obras/:id/kpis`
   - `GET /api/v1/obras/:id/alerts`
3. Keep rollout controlled by feature flags:
   - `NEXT_PUBLIC_FF_GENERAL_TASKS_V1`
   - `NEXT_PUBLIC_FF_TASK_ASSIGN_V1`
   - `NEXT_PUBLIC_FF_OBRA_KPI_V1`
   - `NEXT_PUBLIC_FF_OBRA_ALERTS_V1`
4. Extend analytics taxonomy additively for Wave1 events:
   - `general_task_created`
   - `general_task_assigned`
   - `obra_alert_triggered`
   - future-ready SOP events (already typed for compatibility).
5. Expand audits and smoke checks to include new resources, keeping security and envelope compatibility validated by default.

## Consequences

1. Enables Wave1 product capabilities with no breaking change in `/api/v1`.
2. Preserves org isolation and RBAC patterns already established in production.
3. Improves operational clarity for obra detail through dedicated KPI/alert payloads.
4. Maintains fast rollback path through per-module flags and redeploy.

## Rollback

1. Disable module flags:
   - `NEXT_PUBLIC_FF_GENERAL_TASKS_V1=false`
   - `NEXT_PUBLIC_FF_TASK_ASSIGN_V1=false`
   - `NEXT_PUBLIC_FF_OBRA_KPI_V1=false`
   - `NEXT_PUBLIC_FF_OBRA_ALERTS_V1=false`
2. Redeploy.
3. Keep schema intact (additive migration); no destructive rollback required.
