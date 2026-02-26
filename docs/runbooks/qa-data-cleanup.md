# QA Data Cleanup Runbook (Production)

## Purpose
Clean test records created by automated QA users matching `codex.qa.*@example.com` without touching real customer data.

## Files
- Audit SQL: `supabase/sql/audit_codex_qa_data.sql`
- Cleanup SQL: `supabase/sql/cleanup_codex_qa_data.sql`
- Runner: `scripts/supabase-query.sh`

## Preconditions
1. `supabase_keys.env.codex.txt` present locally (ignored by git).
2. `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` valid.
3. Maintenance operator approved cleanup window.

## Step-by-step
1. Run audit before cleanup:
   ```bash
   ./scripts/supabase-query.sh supabase/sql/audit_codex_qa_data.sql
   ```
2. Confirm QA-only scope (users and orgs must be test-owned).
3. Run cleanup:
   ```bash
   ./scripts/supabase-query.sh supabase/sql/cleanup_codex_qa_data.sql
   ```
4. Run audit again and verify all QA metrics are `0`:
   ```bash
   ./scripts/supabase-query.sh supabase/sql/audit_codex_qa_data.sql
   ```

## Safety Notes
- Cleanup only targets:
  - users with email `codex.qa.*@example.com`
  - organizations where **all** members are QA users.
- If audit returns unexpected values, stop and investigate before cleanup.
- Runbook does not rotate credentials; rotation is a separate security procedure.
