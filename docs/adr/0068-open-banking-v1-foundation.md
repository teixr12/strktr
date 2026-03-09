# ADR 0068: Open Banking V1 Foundation

- Status: accepted
- Date: 2026-03-06

## Context

The 100% program includes future bank connectivity for reconciliation, cash visibility, and financial automation. This is one of the highest-risk domains in the platform because it combines financial data, regulated connectors, consent, and reconciliation logic.

## Decision

Create `openBankingV1` as a read-only readiness foundation with:

- `GET /api/v1/open-banking/readiness`
- server-gated page at `/open-banking`
- sidebar and command palette visibility only for enabled orgs
- health/ops rollout snapshot and program registry integration

This phase does not connect any bank account and does not write any financial event into the system.

## Consequences

Positive:

- Makes consent, reconciliation, and security blockers explicit before integrating any financial provider.
- Reuses the same canary and kill-switch pattern used by the rest of the program.
- Preserves `/api/v1` compatibility and keeps blast radius near zero.

Tradeoffs:

- No account linking or bank data exists in this phase.
- General release remains blocked until consent, audit log, secure connectors, and reconciliation policy are productized.
