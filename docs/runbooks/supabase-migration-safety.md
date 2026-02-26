# Supabase Migration Safety Runbook

## Strategy (Mandatory)
Use `expand -> backfill -> switch -> cleanup` for all structural changes.

## Automated workflow (GitHub Actions)
Use `.github/workflows/supabase-migrations.yml` via `workflow_dispatch`.

Required repository/environment secrets:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`

Recommended GitHub environments:
- `supabase-staging`
- `supabase-production` (configure required reviewers for manual approval)

Dispatch inputs:
1. `target_environment`: `staging` or `production`
2. `stage`: `expand` / `backfill` / `switch` / `cleanup`
3. `migration_file`: path under `supabase/migrations/*.sql`
4. `run_audits`: run pre/post SQL audits
5. `dry_run`: validation only, no DB writes

## Pre-migration
1. Confirm additive migration only (no destructive operations in same cycle).
2. Run audits before applying migration:
   - `./scripts/supabase-query.sh supabase/sql/audit_migrations_applied.sql`
   - `./scripts/supabase-query.sh supabase/sql/audit_tenancy_rls_status.sql`
   - `./scripts/supabase-query.sh supabase/sql/audit_org_id_nulls.sql`
3. Validate rollback plan and feature flag fallback.

## During migration
1. Apply SQL migration.
2. If migration needs backfill, execute idempotent backfill scripts.
3. Keep freeze window as short as possible for structural writes.

## Post-migration
1. Re-run audits (same commands).
2. Validate critical flows in preview/canary.
3. Monitor errors and latency for at least 60 minutes.

## Prohibited in this cycle
- `DROP COLUMN`
- `DROP TABLE`
- irreversible data rewrites without backfill guardrails
