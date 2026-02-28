# ADR 0015 — UI Pagination Controls and Envelope-Aware API Client

- Status: Accepted
- Date: 2026-02-28
- Deciders: STRKTR Engineering

## Context
After Phase 2 backend pagination, several high-volume screens still behaved as if lists were unbounded:
1. `Compras`, `Projetos`, and `Orçamentos` refreshed with `limit=200`, which now clamps at API max page size and can silently truncate results.
2. Frontend `apiRequest` returned only `data`, so screens could not consume `meta.pagination` without custom fetch logic.
3. Existing UI lacked a shared pagination control and operational visibility flag for controlled rollout.

The change had to remain additive, avoid API contract breaks, and keep rollback immediate via feature flags.

## Decision
1. Add envelope-aware client helper in `src/lib/api/client.ts`:
   - keep `apiRequest<T>()` unchanged for backward compatibility,
   - add `apiRequestWithMeta<T, M>()` to read `data`, `meta`, and `requestId`.
2. Add shared enterprise component:
   - `src/components/ui/enterprise/pagination-controls.tsx`.
3. Implement safe paginated list behavior (feature-flagged) for:
   - `Compras`,
   - `Projetos`,
   - `Orçamentos`.
4. Add rollout flag:
   - `NEXT_PUBLIC_FF_UI_PAGINATION_V1` (default on, can disable with `false`).
5. Expose `uiPaginationV1` in `/api/v1/health/ops` for release observability.
6. Reduce initial SSR payload for paginated modules to first 50 items as a safe first-page baseline.

## Consequences
### Positive
- Removes implicit truncation behavior caused by `limit=200` against paginated endpoints.
- Provides reusable pagination UX with no API/schema changes.
- Enables controlled rollback by one flag (`NEXT_PUBLIC_FF_UI_PAGINATION_V1=false`).
- Improves perceived performance by reducing initial page payload in dense modules.

### Negative
- Status filter counters in paginated mode are no longer global totals; UI now avoids misleading counts.
- Some page-level KPIs remain scoped to currently loaded page when no aggregate endpoint exists.

## Rollout / Rollback
- Rollout:
  1. deploy with `NEXT_PUBLIC_FF_UI_PAGINATION_V1=true`,
  2. validate paginated navigation + CRUD refresh in `Compras`, `Projetos`, `Orçamentos`,
  3. monitor `health/ops` flags and error rate.
- Rollback:
  1. set `NEXT_PUBLIC_FF_UI_PAGINATION_V1=false`,
  2. redeploy (or redeploy current config),
  3. modules revert to legacy non-paginated refresh behavior.
