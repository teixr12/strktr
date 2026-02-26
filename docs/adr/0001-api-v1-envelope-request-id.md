# ADR-0001: API v1 canonical envelope with requestId

- Status: Accepted
- Date: 2026-02-25
- Owners: Platform
- Related: API hardening cycle

## Context
Routes had inconsistent payloads and tracing context, making debugging and client integration brittle.

## Decision
All `/api/v1` endpoints must respond with:
- success: `{ data, meta, requestId }`
- error: `{ error, requestId }`

`requestId` must be present in all responses for traceability.

## Consequences
### Positive
- Stable frontend/backend integration
- Better observability and incident triage

### Negative / Tradeoffs
- Additional discipline required across route handlers

## Rollout / Rollback
- Rollout: enforce via CI contract checks and shared response helpers.
- Rollback: none required; contract is backward compatible.
