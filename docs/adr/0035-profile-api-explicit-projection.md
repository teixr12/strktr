# ADR 0035: Explicit Projection for Profile API

- Date: 2026-03-04
- Status: Accepted

## Context

The profile API route (`/api/v1/perfil`) still used `select('*')` for both read and update return payloads. This increases over-fetch risk and makes query shape less explicit for governance/performance controls.

## Decision

Use an explicit field projection for profile queries:

`id, nome, email, avatar_url, empresa, cargo, telefone, created_at, updated_at`

Apply this projection to:

- `GET /api/v1/perfil`
- `PATCH /api/v1/perfil` return selection

## Consequences

- Keeps response payload shape equivalent to current `Profile` contract.
- Reduces uncontrolled `select('*')` usage.
- Improves traceability for performance governance without changing endpoint behavior.

## Rollback

If any regression is observed, revert this ADR patch commit to restore previous query selection behavior.
