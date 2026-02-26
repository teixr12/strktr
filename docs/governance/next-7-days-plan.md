# Next 7 Days Execution Plan (Production-Safe)

## Day 1
- Generate baseline report: `npm run baseline:report`
- Run readiness checks: `npm run release:readiness`
- Create snapshot tag and release note draft

## Day 2
- Safe cleanup only (proved unused files)
- Document cleanup evidence in `docs/reports`

## Day 3
- Organize GitHub Projects board
- Break work into epics: Obras, Portal, Agenda, Aprovações, PDF

## Day 4
- Run Supabase audit pack before/after migration windows
- Follow `docs/runbooks/supabase-migration-safety.md`

## Day 5
- Preview deploy + smoke + canary setup
- Follow `docs/runbooks/weekly-release-train.md`

## Day 6
- Additive contracts for cronograma/portal/pdf behind flags

## Day 7
- Canary internal org
- Monitor 60-120 minutes
- Publish weekly closure report
