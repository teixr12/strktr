# ADR-0003: Feature-flag controlled rollout by module

- Status: Accepted
- Date: 2026-02-25
- Owners: Platform + Product
- Related: Progressive delivery model

## Context
Big-bang releases without guardrails increase production risk.

## Decision
Use feature flags for risky or cross-domain changes, with rollout sequence:
1. Internal validation
2. Canary organizations
3. General availability

## Consequences
### Positive
- Fast mitigation via flag-off fallback
- Safer experimentation and learning loops

### Negative / Tradeoffs
- Requires flag lifecycle governance to avoid stale toggles

## Rollout / Rollback
- Rollout: flags default off until canary passes.
- Rollback: immediate disable of impacted module flag.
