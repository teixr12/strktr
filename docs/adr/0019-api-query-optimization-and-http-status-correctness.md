# ADR-0019: API Query Optimization and HTTP Status Correctness

- Status: Accepted
- Date: 2026-03-01
- Owners: Claude Code / teixr12
- Related: PR #46

## Context
Profiling of the API layer revealed two systemic issues across all v1 endpoints:

1. **Double DB round-trips on paginated endpoints**: Every GET list endpoint (compras, leads, transacoes, orcamentos, projetos) made two separate queries — one for data and one for total count. Supabase supports returning both in a single query via `{ count: 'exact' }`.

2. **Incorrect HTTP status for DB errors**: All 46 instances of `DB_ERROR` responses returned HTTP 400 (Bad Request) instead of HTTP 500 (Internal Server Error). Database failures are server-side errors, not client input errors. This caused monitoring tools to misclassify errors and clients to incorrectly retry with modified payloads.

Additional optimizations: `select('*')` in execution-repository fetching unnecessary columns, analytics adapter creating redundant Supabase sessions per event, and missing composite indexes for frequently queried patterns.

## Decision
- Merge data + count into a single Supabase query using `select(..., { count: 'exact' })` on all 5 paginated GET endpoints
- Change all `DB_ERROR` responses from HTTP 400 to HTTP 500 across 45 route files
- Replace `select('*')` with explicit column lists in `execution-repository.ts`
- Add `React.memo` to `KpiCard`, `StatBadge`, `SectionCard` components
- Add 60s session context cache and parallel analytics dispatch in adapter
- Create new migration with 8 composite indexes targeting hot query paths
- Add reusable `withApiAuth()` helper for future route boilerplate reduction

## Consequences
### Positive
- ~50% fewer DB round-trips on list endpoints
- Correct HTTP semantics enables proper error monitoring and alerting
- Reduced data transfer on execution context queries
- Fewer re-renders on dashboard components
- Faster analytics event dispatch
- Database indexes speed up filtered/sorted queries

### Negative / Tradeoffs
- `{ count: 'exact' }` adds marginal overhead to the single query (vs head-only count), but eliminates an entire network round-trip
- 8 new indexes consume additional disk space and slow writes marginally
- Session cache (60s TTL) means analytics may use a slightly stale token (acceptable for fire-and-forget analytics)

## Rollout / Rollback
- Rollout plan: Merge to main, Vercel auto-deploys. Apply migration `20260301_performance_composite_indexes.sql` via Supabase SQL Editor. Indexes use `CREATE INDEX IF NOT EXISTS` — safe to re-run.
- Rollback plan: Revert the merge commit. Indexes can remain (they don't affect correctness) or be dropped individually.

## Notes
- The `withApiAuth()` helper is opt-in — no existing routes were changed to use it. Can be adopted incrementally.
- All changes are backward-compatible: same API request/response shapes, same database schema.
