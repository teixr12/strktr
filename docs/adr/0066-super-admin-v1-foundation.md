# ADR 0066: Super Admin V1 Foundation

- Status: accepted
- Date: 2026-03-06

## Context

The 100% program needs a controlled path for eventual global governance without exposing cross-tenant write access or skipping compliance gates. The platform already has health telemetry, feature flags, org canary rollout, and module readiness pages, but it did not yet expose a dedicated super-admin readiness surface.

## Decision

Create `superAdminV1` as a read-only foundation with:

- `GET /api/v1/super-admin/readiness`
- server-gated page at `/super-admin`
- sidebar and command palette visibility only for enabled orgs
- health/ops rollout snapshot and program registry integration

This phase remains informational only and does not introduce tenant-spanning actions or global operator writes.

## Consequences

Positive:

- Gives Pod C a safe starting point for global governance readiness.
- Preserves `/api/v1` compatibility and keeps rollout under org canary + kill switch.
- Makes compliance blockers explicit before any general release discussion.

Tradeoffs:

- No real super-admin write capability exists in this phase.
- Cross-tenant analytics, overrides, and operator actions remain blocked until audit log, consent, and policy controls are productized.
