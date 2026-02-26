# GitHub Settings (Manual)

Apply these repository settings to enforce the engineering model.

## Branch protection for `main`
- Require pull request before merging
- Require at least 2 approvals
- Dismiss stale approvals on new commits
- Require conversation resolution before merge
- Require status checks to pass:
  - `quality` (CI)
  - `pr-governance` (Governance)
  - `secrets-scan` (Security)
- Restrict who can push to matching branches

## Rules for hotfix
- Allow `hotfix/*` branches
- Require PR to `main` after production hotfix

## Repository settings
- Enable auto-delete head branches
- Disable force pushes to `main`
- Enable Dependabot alerts and secret scanning (if available)
