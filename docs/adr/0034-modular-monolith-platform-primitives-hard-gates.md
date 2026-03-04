# ADR 0034: Modular Monolith Foundation with Platform Primitives and Hard Governance Gates

- Status: Accepted
- Date: 2026-03-04

## Context

STRKTR is scaling quickly in number of domains (`tasks`, `sops`, `construction-docs`, `portal`, `obras`) and complexity.
Core CRUD is stable, but quality drift risk is increasing: inconsistent route patterns, event naming drift, and performance regressions (`select('*')`, `limit=200`) can accumulate silently.

We need to lock a foundation that keeps `/api/v1` backward-compatible while allowing continuous additive growth.

## Decision

1. Introduce platform primitives under `src/platform/*`:
   - `api/create-api-route` for auth-aware route creation with canonical envelope and latency metadata.
   - `security/*` for reusable webhook and rate-limit policies.
   - `authz/guards` and `data/query-policy` for tenancy and query policy helpers.
   - `events/track-event` and KPI/UI contracts for consistency.
2. Keep existing routes and contracts intact, but migrate reference endpoints incrementally (Wave1 reference: `tasks`, `sops`, `construction-docs`).
3. Add hard governance checks as code:
   - dependency boundaries,
   - analytics taxonomy registry enforcement,
   - static performance budgets,
   - strict UX state audit.
4. Wire governance checks into CI so protected-domain quality is enforced by pipeline, not convention.

## Consequences

1. Faster and safer growth with explicit primitives.
2. Lower regression risk from untyped/undocumented changes.
3. Shared guardrails for AI/agent contributions and human engineering.
4. Temporary friction from stricter gates, accepted as tradeoff for reliability.

## Rollback

1. Soft-disable strict governance gate execution with CI/script-level toggles if needed for incident response.
2. Keep route-level fallbacks to legacy handlers during gradual migration.
3. No destructive DB or API contract changes are required for this ADR.
