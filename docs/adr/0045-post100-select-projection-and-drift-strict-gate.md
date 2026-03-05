# ADR 0045 — Post-100 Hardening: explicit projections and strict drift gate

- Date: 2026-03-05
- Status: Accepted

## Context

After Wave2 reached 100% rollout, the main remaining risks were operational drift and query over-fetch:

1. Some core read routes still used `select('*')`, increasing payload variance and performance risk as schemas evolve.
2. The daily analytics drift workflow collected drift data but did not fail automatically when drift exceeded the accepted threshold.

The release policy remains additive and backward-compatible for `/api/v1`.

## Decision

1. Replace wildcard selects with explicit field projections in high-read routes:
   - `/api/v1/equipe`
   - `/api/v1/equipe/[id]`
   - `/api/v1/knowledgebase`
   - `/api/v1/knowledgebase/[id]`
   - `/api/v1/notificacoes`
2. Add strict mode to analytics drift audit script:
   - `AUDIT_DRIFT_STRICT=1` returns non-zero when status is `warn`.
3. Enforce strict mode in the scheduled analytics drift workflow.
4. Tighten governance budget for wildcard selects:
   - `select('*')` max reduced from `44` to `34`.

## Consequences

### Positive

1. Lower over-fetch exposure in core endpoints.
2. Faster detection of external analytics parity regressions.
3. Stronger CI guardrail against reintroducing wildcard projections.

### Trade-offs

1. Drift jobs can fail more often when external providers are unstable; this is intentional for operational visibility.
2. Explicit projections require maintenance when adding new fields to affected responses.

## Rollback

1. Projection rollback: revert individual endpoint projection to previous query shape.
2. Drift strict rollback: run script without `AUDIT_DRIFT_STRICT=1` and/or remove strict workflow env for temporary compatibility.
3. Governance rollback: raise the `select('*')` budget ceiling if an emergency patch requires temporary wildcard usage.

