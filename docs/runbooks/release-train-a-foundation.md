# Train A Runbook

## Goal
- Cut the current branch into a first PR that only ships the program control plane and branch hygiene.
- Avoid dragging Pod B and Pod C feature work into the first merge.

## Preconditions
1. `financeReceipts` production rollout is no longer in `allowlist` or `canary`.
2. Latest production checks are green:
   - `health/ops=ok`
   - drift `<5%`
   - capture probe `pass`
3. No new risky production rollout is started in parallel.

## Include in Train A
1. Program control plane:
   - `src/server/program/*`
   - `src/shared/types/program-status.ts`
   - `src/app/api/v1/ops/program/route.ts`
2. Rollout control:
   - `src/lib/feature-flags.ts`
   - `src/server/feature-flags/wave2-canary.ts`
   - `src/app/api/v1/health/ops/route.ts`
3. Shell and discoverability wiring:
   - `src/app/(app)/layout.tsx`
   - `src/components/layout/*`
   - `src/components/ui/command-palette.tsx`
4. Governance and smoke:
   - `tests/e2e/smoke.spec.ts`
   - `scripts/audit-ux-quality.mjs`
   - relevant audit SQL updates
5. Docs:
   - ADRs for program control plane
   - runbooks for rollout and release train cut

## Explicitly Exclude from Train A
1. Generated reports under `docs/reports/*`
2. Local tooling artifacts under `.claude/`
3. Pod B domain pages/APIs/migrations
4. Pod C domain pages/APIs/migrations

## Validation
Run in this order:
1. `mkdir -p test-results && npm run lint`
2. `npm run validate:api-contracts`
3. `npm run build`
4. `npm run governance:all`
5. `npm run test:e2e`

## Scope Cut
Before opening the PR, classify the working tree:
1. `npm run governance:release-trains`
2. Confirm:
   - `Train A` contains only foundation/control-plane files
   - `Train B` and `Train C` remain out of scope for the first PR
   - `Shared Hotspots` are split intentionally, not merged wholesale
   - `Ignored` contains generated artifacts only

## Deploy Policy
1. Merge only after the active production rollout window closes.
2. Deploy with all new module flags `OFF`.
3. Confirm:
   - `/api/v1/health/ops`
   - `/api/v1/ops/program`
   - smoke route coverage

## Rollback
1. Revert the Train A PR.
2. Redeploy.
3. Recheck:
   - `health/ops`
   - `ops/release`
   - smoke suite
