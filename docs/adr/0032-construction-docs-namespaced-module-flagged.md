# ADR 0032: Construction Docs Namespaced Module (Additive, Flagged, 404-Safe)

- Status: Accepted
- Date: 2026-03-04

## Context

Wave1/Portal-first execution requires a new `construction-docs` capability without impacting existing CRM/ERP flows.
The module must deliver visits/photos/templates/document generation/export/share while preserving:

1. Backward compatibility of existing `/api/v1` routes.
2. Org-first multi-tenant isolation with RLS.
3. Immediate rollback via feature flag.
4. No destructive schema changes.

The platform already has reusable pieces (Supabase service-role storage, Resend e-mail, WhatsApp helper, telemetry adapter), but no dedicated namespaced construction docs domain.

## Decision

1. Introduce an additive namespaced module:
   - UI: `/construction-docs/*`
   - API: `/api/v1/construction-docs/*`
   - Public share: `/portal/construction-docs/:token`
2. Add migration `20260304_construction_docs_expand.sql` with additive tables:
   - `construction_docs_project_links`, `construction_docs_visits`, `construction_docs_rooms`,
   - `construction_docs_photos`, `construction_docs_annotations`,
   - `construction_docs_templates`, `construction_docs_documents`,
   - `construction_docs_share_links`, `construction_docs_audit_logs`.
3. Enforce org-first RLS on all new tables using `get_user_org_ids(auth.uid())` and tenant-scoped queries.
4. Gate module with canonical flag (`FEATURE_CONSTRUCTION_DOCS`, mirrored to `NEXT_PUBLIC_FF_CONSTRUCTION_DOCS_V1`).
5. Apply 404-safe behavior when flag is OFF before auth checks (`withConstructionDocsAuth`) to avoid route exposure.
6. Keep exports/shares additive and fail-safe:
   - PDF + CSV available,
   - XLSX endpoint returns explicit CSV fallback,
   - WhatsApp fallback to click-to-chat URL,
   - e-mail via existing Resend integration.
7. Add smoke coverage for gate behavior (`flag OFF => 404`, `flag ON => 401 without token`) and publish rollout runbook.

## Consequences

1. Construction Docs evolves independently with low regression risk on core modules.
2. Existing API contracts remain stable; no rename/remove.
3. Security posture remains aligned with org-first tenancy and RBAC.
4. Operational rollout is deterministic via one kill-switch and non-destructive DB changes.

## Rollback

1. Set `FEATURE_CONSTRUCTION_DOCS=false`.
2. Redeploy.
3. Validate `health/ops` shows `flags.constructionDocs=false` and endpoints return 404-safe.
4. Keep migration/data in place (additive-only), no destructive rollback.

## Addendum (2026-03-04)

1. Outbound channels (`send-email`, `share/whatsapp`) now attempt to auto-create a public tokenized share link when `share_url` is omitted.
2. Backward-compatible fallback remains unchanged: if share link creation fails, endpoint uses internal authenticated document URL to avoid hard failures.
3. Audit payload now records `share_url_source` (`explicit`, `auto_public_link`, `internal_fallback`) for operational traceability.
