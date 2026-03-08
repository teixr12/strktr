# ADR 0067: Big Data V1 Foundation

- Status: accepted
- Date: 2026-03-06

## Context

The 100% program includes a future big-data domain for regional insights, cost benchmarks, and aggregated best-practice signals. This domain is highly sensitive because it can drift into cross-tenant exposure, legal/privacy risk, and weakly governed data collection if opened too early.

## Decision

Create `bigDataV1` as a read-only readiness foundation with:

- `GET /api/v1/big-data/readiness`
- server-gated page at `/big-data`
- sidebar and command palette visibility only for enabled orgs
- health/ops rollout snapshot and program registry integration

This phase does not expose any real aggregated tenant data.

## Consequences

Positive:

- Makes privacy, anonymization, and data-contract blockers explicit before implementing analytics products.
- Keeps rollout under the same org-canary and kill-switch model as the rest of the program.
- Preserves `/api/v1` compatibility.

Tradeoffs:

- No real insights or cross-tenant metrics are available in this phase.
- Big data remains blocked for general release until legal basis, anonymization, and retention are productized.
