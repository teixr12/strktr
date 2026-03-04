# ADR 0033: Analytics Drift Parity via Server-Side Checklist Mirroring

- Status: Accepted
- Date: 2026-03-04

## Context

Wave1 closeout requires analytics internal/external drift to stay controlled without changing business contracts.
Recent audits showed parity noise on checklist and page view events, while `portal_approval_decision` was already being reconciled.

We need to improve event consistency with minimal risk:

1. Preserve internal analytics as source of truth.
2. Avoid duplicate client/server emission patterns that inflate divergence.
3. Keep API contracts and domain semantics unchanged.
4. Maintain immediate rollback via existing analytics flags.

## Decision

1. Emit `ChecklistItemToggled` external mirror from server-side mutation path (`/api/v1/obras/:id/checklists/items/:itemId/toggle`) by setting `mirrorExternal: true`.
2. Remove duplicate client-side `ChecklistItemToggled` tracking in obra checklist UI for this mutation path.
3. Expand reconciliation target set to include `ChecklistItemToggled` in addition to critical events already monitored.
4. Refine drift audit query cohorts to compare equivalent populations:
   - `PageViewed`: require `properties.user_id IS NOT NULL`.
   - `ChecklistItemToggled`: server-sourced only (`properties.source = 'server'`).
5. Keep behavior additive and non-breaking: no API field removals/renames and no DB schema change.

## Consequences

1. Better internal/external parity for checklist actions with lower duplication risk.
2. Cleaner drift signals for operations and release decisions.
3. No impact on domain data integrity, tenancy, or RBAC logic.

## Rollback

1. Disable external analytics mirror via `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=false` if needed.
2. Redeploy and continue internal tracking only.
3. Revert PR if required; no migration rollback is needed.
