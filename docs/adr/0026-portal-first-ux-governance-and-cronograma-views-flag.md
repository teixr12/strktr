# ADR 0026: Portal-first UX Governance and Cronograma Views Flag

- Status: Accepted
- Date: 2026-03-03
- Deciders: STRKTR Engineering
- Relates to: ADR 0003, ADR 0016, ADR 0017, ADR 0024

## Context
- The Portal-first closeout requires stronger UX-state consistency across dense modules without changing business contracts.
- We introduced additive UI states in modules not previously covered by the UX gate (Calendario, Equipe, Knowledgebase, Configuracoes, Compras, Projetos).
- We added a new cronograma visual experience (timeline/calendar/board) and exposed a related feature flag in `health/ops`.
- Governance requires an ADR whenever API v1 files are touched, even for additive observability fields.

## Decision
- Keep all changes additive and backward-compatible.
- Introduce `NEXT_PUBLIC_FF_CRONOGRAMA_VIEWS_V1` as a dedicated rollout flag for cronograma visual modes.
- Expose `cronogramaViewsV1` in `/api/v1/health/ops` diagnostics as an additive field only.
- Expand `audit:ux-quality` module coverage to enforce loading/empty/error/retry/feedback visibility across 15 modules.
- Preserve existing API contracts and avoid schema migrations in this cycle.

## Consequences
- Positive:
  - Safer rollout of cronograma visual modes with immediate kill-switch capability.
  - Better operational confidence through health diagnostics and broader UX quality evidence.
  - No API contract breakage and no migration risk.
- Tradeoffs:
  - Additional flag management overhead.
  - UX governance now depends on an audit script that must keep module coverage current.

## Rollout and Rollback
- Rollout:
  - Canary by org and module-level toggles.
  - Monitor health/ops, JS errors, 5xx, UX gate reports, analytics drift.
- Rollback:
  - Disable module flags (`cronogramaViewsV1` and module-specific UI flags).
  - Redeploy if required.
  - No database rollback needed.

## Validation
- `npm run lint`
- `npm run build`
- `npm run validate:api-contracts`
- `npm run test:e2e`
- `npm run audit:ux-quality`
