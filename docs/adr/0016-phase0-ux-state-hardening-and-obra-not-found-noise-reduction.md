# ADR 0016 — Phase 0 UX State Hardening and Obra Not-Found Noise Reduction

- Status: Accepted
- Date: 2026-02-28
- Deciders: STRKTR Engineering

## Context
Phase 0 still had residual confidence gaps that affected perceived product quality:
1. `Orçamentos` still had a legacy client-side print fallback (`window.print`) that bypassed the server-side PDF export path.
2. Dense modules (`Financeiro`, `Leads`, `Obras`, `Portal`) were inconsistent in loading/error/retry rendering, making failures look like blank or unstable states.
3. Cross-tenant access attempts to `/api/v1/obras/[id]` produced noisy `error` logs for expected `not_found` outcomes, increasing operational noise during E2E and monitoring.

Changes had to be additive, backward compatible, and fully reversible by existing flags and deploy rollback.

## Decision
1. Remove legacy front-only print fallback from `Orçamentos` UI flow:
   - no `window.print` fallback in export path,
   - keep server-side `/api/v1/orcamentos/:id/pdf` as canonical export.
2. Standardize UX states in critical modules:
   - `Portal`: skeleton loading state and consistent `aria-busy` feedback on comment/approval actions.
   - `Leads`: explicit error block + retry and skeleton state for lane loading.
   - `Financeiro`: explicit error + retry for list and desvio summary, including skeleton for loading.
   - `Obras`: refresh error block + retry for list refresh failures.
3. Harden `/api/v1/obras/[id]` logging behavior:
   - treat Supabase `PGRST116` as expected `not_found`,
   - downgrade expected cases from `error` to `warn`,
   - return generic safe message (`Obra não encontrada`) to reduce enumeration signal and log noise.

## Consequences
### Positive
- Eliminates remaining critical front-only export behavior in the budget flow.
- Improves user trust with consistent `loading/error/retry` feedback in high-frequency modules.
- Reduces operational alert noise from expected cross-tenant/not-found requests.
- Keeps API contract stable (`/api/v1` without breaking changes).

### Negative
- When PDF feature flag is disabled, UI now shows explicit unavailability instead of local print fallback.
- Additional state rendering logic increases UI code complexity in affected components.

## Rollout / Rollback
- Rollout:
  1. deploy with existing module flags unchanged,
  2. validate export, list loading, and retry paths in `Orçamentos`, `Financeiro`, `Leads`, `Obras`, and `Portal`,
  3. monitor `5xx`, client errors, and log volume for `/api/v1/obras/[id]`.
- Rollback:
  1. rollback deployment if regression appears,
  2. for UI-only regressions, disable affected module flags where available,
  3. no database rollback required.
