# Cleanup Policy (Safe)

## Goal
Reduce technical noise without deleting valid product work.

## Rules
1. Remove only files proven unused by global reference search.
2. Split cleanup into small PRs by domain.
3. Never combine cleanup with unrelated feature changes.
4. Avoid destructive commands without explicit approval.

## Checklist before deletion
- [ ] `rg` search shows no references.
- [ ] Build and lint still pass.
- [ ] Affected domain owner reviewed.
- [ ] Rollback path documented (restore file/commit).
