# ADR 0056: Program Rollout Registry and Ops Status for the 90-Day 100% Program

## Status
Accepted — March 6, 2026

## Context
- The repository already has safe rollout primitives for live modules:
  - boolean kill switches
  - org canary gating
  - `health/ops`
  - `ops/release`
- The 90-day “100% em tudo” program expands scope beyond currently shipped modules and introduces parallel pods:
  - Pod A: core promotions already coded
  - Pod B: ops + finance first
  - Pod C: revenue + platform + regulated domains
- Without a central registry, rollout metadata will drift across:
  - feature flags
  - canary envs
  - health diagnostics
  - runbooks
  - future product shells

## Decision
1. Add future domain flags now, all default `false`.
2. Extend the generic org canary helper so future domains can adopt the same rollout contract as current modules.
3. Create a central program registry in server code that maps:
   - module key
   - pod
   - risk
   - delivery state
   - compliance gate requirement
   - feature flag key
   - canary key
4. Add an authenticated operational endpoint `GET /api/v1/ops/program` with the full program status payload.
5. Keep `health/ops` public and additive:
   - expose only a compact program summary
   - do not expose the full internal module inventory there
6. Treat regulated domains as implementable now but blocked for general release until the minimum compliance gate passes.

## Consequences
- Future pods can build in parallel without inventing new rollout contracts.
- Operations gets a single typed source of truth for program status.
- Public health remains stable while internal ops gains the full roadmap-aware view.
- Slightly more flag surface area now, but lower drift and safer promotion later.
