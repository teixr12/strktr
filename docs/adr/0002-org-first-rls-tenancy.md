# ADR-0002: Org-first tenancy with RLS enforcement

- Status: Accepted
- Date: 2026-02-25
- Owners: Platform + Data
- Related: Supabase tenancy migrations

## Context
User-scoped filters were insufficient for collaborative org workflows and increased cross-tenant risk.

## Decision
Adopt `org_id` as primary tenant key across core domain entities and enforce RLS org-first policies.

## Consequences
### Positive
- Strong tenant isolation
- Better multi-user collaboration per organization

### Negative / Tradeoffs
- Migration complexity and policy hardening overhead

## Rollout / Rollback
- Rollout: additive schema changes + backfill + policy activation.
- Rollback: disable affected feature flags; keep schema additive and safe.
