# ADR 0031: Wave1 SOP Builder V1 (Additive, Flagged)

- Status: Accepted
- Date: 2026-03-03

## Context

Wave1 requires a production-grade SOP workflow with:

1. SOP CRUD scoped by organization.
2. Document export and operational sharing paths (PDF, WhatsApp, e-mail).
3. Zero breaking changes in existing `/api/v1` contracts.
4. Safe rollout and immediate rollback through feature flags.

The current platform has PDF and communication integrations that can be reused, but no dedicated SOP domain model and endpoints yet.

## Decision

1. Introduce additive `sops` domain with migration `20260303_sops_v1_expand.sql`, including:
   - `org_id` tenancy key,
   - `obra_id`/`projeto_id` optional links,
   - JSON blocks and branding payload,
   - RLS policies scoped by `get_user_org_ids(auth.uid())`.
2. Add additive endpoints under `/api/v1/sops`:
   - `GET/POST /api/v1/sops`
   - `PATCH/DELETE /api/v1/sops/:id`
   - `POST /api/v1/sops/:id/export/pdf`
   - `POST /api/v1/sops/:id/share/whatsapp`
   - `POST /api/v1/sops/:id/send-email`
3. Gate all SOP UX exposure by `NEXT_PUBLIC_FF_SOP_BUILDER_V1` (default OFF).
4. Reuse existing platform capabilities for PDF generation, WhatsApp and e-mail integration with fail-safe fallback behavior.
5. Extend smoke E2E coverage to enforce unauthorized envelope behavior for all new SOP endpoints.

## Consequences

1. SOP module becomes available without altering existing domain flows.
2. API surface remains backward-compatible and additive.
3. Multi-tenant security posture is maintained through org-scoped queries + RLS.
4. External integration outages do not block core CRUD functionality (fallback links/paths remain available).

## Rollback

1. Disable `NEXT_PUBLIC_FF_SOP_BUILDER_V1`.
2. Redeploy.
3. Keep migration/data in place (non-destructive); existing modules continue unaffected.
