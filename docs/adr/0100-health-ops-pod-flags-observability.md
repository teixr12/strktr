# 0100 — Health/Ops Pod Flag Observability

## Status
Accepted

## Context

The `Train A/B/C` foundations are already merged, but production `GET /api/v1/health/ops`
did not expose the merged Pod B/C rollout flags. As a result, those keys appeared as
`null` in operational checks, which weakened rollout readability and made it harder to
distinguish between "explicitly off" and "not surfaced".

## Decision

Expose the merged Pod B/C feature flags in `health/ops` using the same additive,
backward-compatible flag evaluation already used for the existing core flags.

This change is read-only, additive, and does not alter any live rollout behavior.

## Consequences

- Production health checks can report the merged-but-off Pod B/C domains explicitly.
- Rollout governance becomes easier to audit during staged activation.
- No API contract is removed or renamed; consumers only gain extra keys in the payload.
