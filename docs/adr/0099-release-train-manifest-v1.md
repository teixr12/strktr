# ADR 0099: Release Train Manifest V1

## Context
- The local branch now contains a large amount of additive work across Pod B and Pod C.
- Production is still running an active `financeReceipts` rollout.
- Shipping this as one merge would create unnecessary blast radius and make rollback attribution weak.

## Decision
- Split the branch operationally into three release trains:
  - `Train A`: foundation/control plane
  - `Train B`: Pod B foundations
  - `Train C`: Pod C foundations
- Keep release train metadata in `program-status` so `/api/v1/ops/program` remains the source of truth.
- Ignore local/generated artifacts that should not enter PR scope:
  - `.claude/`
  - generated markdown reports under `docs/reports/*` except repository keep/readme files

## Consequences
- The next merge can be cut with a much smaller and more auditable blast radius.
- Program status now explains not only modules but also the intended release train order.
- The branch remains additive and deploy-safe because all new modules continue to default to `OFF`.
