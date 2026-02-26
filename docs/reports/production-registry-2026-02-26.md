# STRKTR Production Registry — 2026-02-26

## Deployment Snapshot
- App URL: https://strktr.vercel.app
- Health status: `ok`
- Active version (health endpoint): `9e2d9a5ce5c0af70da6065f1053165cdf88549be`
- Flags seen in health:
  - `checklistDueDate=true`
  - `productAnalytics=true`

Source: `docs/reports/production-audit-20260226-060505.md`

## Supabase Snapshot
- Migrations audit: `ok`
- RLS tenancy audit: `ok`
- `org_id` null audit (core tables): all `0`

Source: `docs/reports/production-audit-20260226-060505.md`

## Governance Readiness
- Contract checks: configured (`npm run validate:api-contracts`)
- PR governance checks: configured (`npm run governance:pr`)
- Security scan workflow: configured (`.github/workflows/security.yml`)
- Weekly release runbook: `docs/runbooks/weekly-release-train.md`
- Supabase migration safety runbook: `docs/runbooks/supabase-migration-safety.md`

## Manual Actions Pending
1. Apply branch protection on `main` per `docs/governance/github-settings.md`.
2. Confirm CODEOWNERS handle (`.github/CODEOWNERS`) matches official GitHub owner/team.
3. Create GitHub Project board and epics using `docs/governance/backlog-epics.md`.
4. Start weekly release window + canary policy in operations calendar.
