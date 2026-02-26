# Contributing to STRKTR

## Engineering Principles
- Keep shipping velocity high with low regression risk.
- Treat `/api/v1` as a stable contract.
- Prefer additive changes: `expand -> backfill -> switch -> cleanup`.
- Use feature flags for risky or user-facing rollouts.

## Branching Model
- `main`: protected, release-ready branch.
- Feature work: `codex/<scope>-<short-description>`.
- Hotfix: `hotfix/<scope>-<short-description>`.
- Direct pushes to `main` are not allowed.

## Commit Convention
Use Conventional Commits:
- `feat:` new feature
- `fix:` bug fix
- `refactor:` internal code improvement
- `chore:` maintenance
- `docs:` documentation only
- `test:` test changes

## Pull Request Rules
1. Open PR against `main`.
2. Fill PR template completely.
3. Attach rollout plan and rollback path for risky changes.
4. For API/auth/migration changes, include at least one ADR update.
5. Ensure checks pass:
- `npm run lint`
- `npm run build`
- `npm run validate:api-contracts`
- `npm run test:e2e`

## Review and Approval
- Critical modules (`api`, `auth`, `supabase/migrations`) require 2 approvals.
- UI-only isolated changes require 1 approval.

## Definition of Done
A change is done only when:
- tests and CI are green,
- rollout and rollback are defined,
- observability impact is described,
- docs/runbooks are updated when needed.
