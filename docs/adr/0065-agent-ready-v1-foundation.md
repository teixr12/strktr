# ADR 0065: Agent Ready V1 Foundation

- Status: accepted
- Date: 2026-03-06

## Context

The 100% program needs an internal, read-only foundation for agent-facing readiness before any external connector, tool execution, or generalized AI action path is exposed. The platform already has tenant auth, feature flags, org canary rollout, and health telemetry, but it did not yet expose a single readiness surface for agent-safe expansion.

## Decision

Create `agentReadyV1` as a read-only, canary-gated foundation with:

- `GET /api/v1/agent-ready/readiness`
- server-side page gating at `/agent-ready`
- command palette and sidebar visibility only for enabled orgs
- health/ops rollout snapshot and program registry integration

No write-capable action gateway is introduced in this phase.

## Consequences

Positive:

- Gives Pod C a safe internal control surface before opening regulated agent connectors.
- Keeps `/api/v1` backward-compatible.
- Reuses the same org canary and 404-safe behavior as other staged domains.

Tradeoffs:

- This phase is informational only and does not yet solve audit-log, scoped action execution, or prompt defense policy enforcement.
- External agent/general release remains blocked until the compliance gate is closed.
