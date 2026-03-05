# ADR 0047 — Post-100: remove limit=200 fallbacks and optimize leads SLA query path

- Date: 2026-03-05
- Status: Accepted

## Context

After the first post-100 performance closure, `limit=200` remained mostly in fallback UI queries and in one SLA endpoint path.
These limits were either:

1. non-primary fallback fetches (when pagination flag is off), or
2. server scans that were loading rows only to derive counts.

The platform remains under additive-only and `/api/v1` backward-compatible policy.

## Decision

1. Optimize `/api/v1/leads/sla`:
   - replace row-scan + in-memory filter with:
     - `totalAtivos` count query (`head + count`)
     - `totalParados` count query (`head + count` with stalled predicate)
     - compact stalled list query (`limit(20)`)
2. Replace client fallback requests using `limit=200` with safer, lighter forms:
   - paginated calls (`page=1&pageSize=100`) where endpoint already supports pagination
   - `limit=100` for lightweight lookup routes that still use `limit`
3. Tighten governance budget for `limit-200` from `11` to `2`.

## Consequences

### Positive

1. Lower payload and query pressure in fallback paths.
2. More accurate SLA counts independent of fixed row scan limits.
3. Stronger prevention of future reintroduction of `limit=200`.

### Trade-offs

1. Fallback lists now load fewer rows by default (100), which is acceptable because pagination-first flow remains primary.
2. SLA endpoint complexity increased slightly due to multiple targeted queries.

## Rollback

1. Revert individual fallback query parameter changes back to previous values.
2. Restore previous SLA row-scan implementation if needed for incident response.
3. Raise `limit-200` governance budget temporarily (from `2` back to previous threshold) if emergency patches require it.

