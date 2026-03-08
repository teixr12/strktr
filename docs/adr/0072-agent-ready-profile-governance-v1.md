# ADR 0072: Agent Ready Profile Governance V1

- Status: accepted
- Date: 2026-03-06

## Context

`agentReadyV1` already exposed a read-only readiness surface, but Pod C still lacked a persisted control layer to define which internal agent profiles could exist per tenant, which scopes they could request, and which planned actions they could target. Opening real agent connectors without this governance layer would force product and security decisions into ad hoc code paths.

## Decision

Add an internal, tenant-scoped governance layer behind the existing `agentReadyV1` flag:

- extend `GET /api/v1/agent-ready/readiness` with planned scopes and actions
- add `GET/POST /api/v1/agent-ready/profiles`
- add `PATCH /api/v1/agent-ready/profiles/:id`
- persist profiles in `public.agent_ready_profiles`
- keep the entire domain `404-safe` when the feature or org canary is off

This phase does not introduce any executable agent action gateway.

## Consequences

Positive:

- Creates a real control plane for internal agent profiles before any external connector or write-capable agent path exists.
- Keeps all changes additive and org-scoped.
- Reuses the existing canary/health/audit model.

Tradeoffs:

- Profiles remain governance-only records; they do not yet create tokens, secrets, or runnable sessions.
- External/general release is still blocked by audit log, prompt defense, distributed rate limit, and connector handshake requirements.
