# GitHub Settings (Manual)

Apply these repository settings to enforce the engineering model.

## Branch protection for `main`
- Require pull request before merging
- Require at least 0 approval(s) during solo-beta (temporário)
- Dismiss stale approvals on new commits
- Require conversation resolution before merge
- Require branches to be up to date before merging
- Require linear history
- Require status checks to pass:
  - `quality` (CI)
  - `pr-governance` (Governance)
  - `secrets-scan` (Security)
  - `Vercel` (deploy status)
- Restrict who can push to matching branches
- Disallow force pushes
- Disallow branch deletions

## Rules for hotfix
- Allow `hotfix/*` branches
- Require PR to `main` after production hotfix

## Repository settings
- Enable auto-delete head branches (`delete_branch_on_merge=true`)
- Disable force pushes to `main`
- Enable Dependabot alerts and secret scanning (if available)
