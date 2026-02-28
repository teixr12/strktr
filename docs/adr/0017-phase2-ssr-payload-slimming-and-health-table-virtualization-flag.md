# ADR 0017 — Phase 2 SSR Payload Slimming and Health Flag for Table Virtualization

- Status: Accepted
- Date: 2026-02-28
- Deciders: STRKTR Engineering

## Context
Phase 2 performance hardening still had two operational gaps:
1. SSR first-page queries for `Leads` and `Financeiro` still used broad selects (`select('*')`), increasing payload and parsing overhead.
2. Feature rollout observability lacked explicit `tableVirtualization` visibility in `/api/v1/health/ops`, making runtime verification harder during canary/rollback drills.

Changes needed to remain additive, contract-safe, and reversible by existing feature flags.

## Decision
1. Replace SSR broad selects with explicit column lists in:
   - `src/app/(app)/leads/page.tsx`
   - `src/app/(app)/financeiro/page.tsx`
2. Normalize `transacoes.obras` relation shape in `FinanceiroPage` to keep `FinanceiroContent` input contract stable (`{ nome } | null`).
3. Expose `tableVirtualization` in `/api/v1/health/ops` using `NEXT_PUBLIC_FF_TABLE_VIRTUALIZATION`.

## Consequences
### Positive
- Reduces SSR payload surface in dense modules without changing route or API contracts.
- Improves operational confidence by making virtualization rollout state visible in health checks.
- Preserves compatibility with existing UI/data flow.

### Negative
- Adds a small normalization step for `Financeiro` SSR relation mapping.
- Explicit select lists require maintenance if model fields evolve.

## Rollout / Rollback
- Rollout:
  1. deploy normally with existing flags,
  2. validate `/leads`, `/financeiro`, and `/api/v1/health/ops`,
  3. monitor `p95`, `5xx`, and client errors.
- Rollback:
  1. rollback deployment if SSR regressions appear,
  2. disable `NEXT_PUBLIC_FF_TABLE_VIRTUALIZATION` if virtualization path is implicated,
  3. no database rollback required.
