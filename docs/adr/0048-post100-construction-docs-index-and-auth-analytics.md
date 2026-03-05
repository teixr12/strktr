# ADR 0048 — Post-100: Construction Docs projects index and auth analytics completion

- Date: 2026-03-05
- Status: Accepted

## Context

Post-100 hardening identified three quick-win gaps still open:

1. Construction Docs discoverability was weak because the navigation entry pointed directly to templates and there was no projects index flow.
2. Auth event taxonomy (`auth_login`, `auth_sign_up`) existed in registry but was not emitted in login/register UI flows.
3. Two sensitive endpoints still had `limit(200)` hard caps (`general-tasks/assignees`, `portal/session/:token` comments).

Changes must remain additive and backward-compatible for `/api/v1`.

## Decision

1. Add an additive discoverability API and UI flow:
   - `GET /api/v1/construction-docs/projects`
   - `/construction-docs/projects` page and component
   - `/construction-docs` root redirects to `/construction-docs/projects`
   - sidebar and command palette entry updated to projects index
2. Emit auth analytics on login/register flows:
   - `auth_login` on password and OAuth login attempt outcomes
   - `auth_sign_up` on password and OAuth sign-up attempt outcomes
3. Remove remaining `limit(200)` hard caps:
   - assignees route without fixed hard cap
   - portal comments route with pagination policy (`page/pageSize`) and envelope meta

## Consequences

### Positive

1. Construction Docs now has a project-first entry path, reducing navigation friction.
2. Auth analytics taxonomy is complete for core authentication actions.
3. Governance performance budget no longer has remaining `limit(200)` occurrences.

### Trade-offs

1. New projects index endpoint aggregates project/link/visit/document counts and adds moderate query complexity.
2. OAuth emit success is recorded at authorization handoff time (before callback exchange), which is acceptable for funnel visibility but not final session confirmation.

## Rollback

1. Disable discoverability path by reverting nav links and route additions.
2. Revert auth emitter calls in login/register pages if event volume/noise needs immediate containment.
3. Revert per-endpoint pagination change in portal session comments if incident requires restoring prior behavior.
