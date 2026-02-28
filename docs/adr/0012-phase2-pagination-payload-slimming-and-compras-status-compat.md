# ADR 0012 — Phase 2 Safe Pagination, Payload Slimming, and Compras Status Compatibility

- Status: Accepted
- Date: 2026-02-28
- Deciders: STRKTR Engineering

## Context
Phase 2 required real performance and consistency gains without breaking existing flows:
1. list endpoints returned large payloads with `limit` only and no stable pagination metadata,
2. dashboard SSR used broad `select('*')` queries across multiple domains,
3. `compras` approval flow already used statuses (`Pendente Aprovação Cliente`, `Revisão Cliente`) that could diverge from legacy DB check constraints in some environments.

The solution needed to remain additive, keep `/api/v1` envelope compatibility, and preserve existing frontend behavior.

## Decision
1. Introduce a shared pagination helper (`src/lib/api/pagination.ts`) with backward compatibility:
   - keeps `limit` support,
   - adds `page` and `pageSize`,
   - returns additive metadata: `count`, `page`, `pageSize`, `total`, `hasMore`.
2. Apply this pagination model to critical list endpoints:
   - `/api/v1/leads`,
   - `/api/v1/compras`,
   - `/api/v1/transacoes`,
   - `/api/v1/projetos`,
   - `/api/v1/orcamentos`.
3. Slim dashboard SSR query payload to selected fields used by UI and bounded query size.
4. Add idempotent migration to align `compras_status_check` with approval-gate statuses:
   - `supabase/migrations/20260228_compras_status_check_approval_compat.sql`.

## Consequences
### Positive
- More predictable API list behavior for current UI and future infinite-scroll/pagination UX.
- Lower dashboard transfer/render cost without changing user-facing behavior.
- Prevents approval-flow failures caused by status constraint drift across environments.

### Negative
- Each paginated endpoint performs an extra count query (`head+exact`) to return total metadata.
- Migration updates check constraint definition, requiring controlled rollout through migration workflow.

## Rollout / Rollback
- Rollout:
  1. deploy app changes,
  2. validate endpoint metadata and dashboard behavior,
  3. run migration in staging (`dry_run` then apply),
  4. run migration in production with manual approval.
- Rollback:
  1. keep existing API compatibility by continuing to accept `limit`,
  2. disable affected UI flag(s) and redeploy if needed,
  3. apply compensating migration if status constraint must revert.
