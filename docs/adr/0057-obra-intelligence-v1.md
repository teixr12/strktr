# ADR 0057: Obra Intelligence V1 as an Additive First-Fold Aggregation

## Status
Accepted — March 6, 2026

## Context
- Obra detail already exposes:
  - execution summary
  - KPI endpoint
  - alerts endpoint
  - weather/map/logistics panel
- Users still need a single first-fold layer that answers:
  - what needs action now
  - how risky the obra is
  - whether external context is ready
  - whether cash and execution are aligned
- We need this without replacing current endpoints or changing the current obra workflow.

## Decision
1. Add `GET /api/v1/obras/:id/intelligence` as a new additive endpoint.
2. Reuse existing repositories and execution/weather logic instead of introducing a new data model.
3. Gate the endpoint and first-fold UI behind `NEXT_PUBLIC_FF_OBRA_INTELLIGENCE_V1` plus org canary.
4. Keep the existing execution summary, KPI, alerts, and weather/logistics flows intact.
5. Render a new first-fold intelligence panel only when the feature is enabled for the org.

## Consequences
- Faster operator understanding on the obra page without removing existing UI.
- Lower implementation risk because the payload is composed from current persisted sources.
- Slight duplication with existing KPI/alerts reads, acceptable for V1 until broader convergence work.
