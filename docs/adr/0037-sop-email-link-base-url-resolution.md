# ADR 0037: Resolve SOP email link base URL dynamically

- Date: 2026-03-04
- Status: Accepted
- Owners: API Platform / Product Ops

## Context

`POST /api/v1/sops/:id/send-email` used a hardcoded production URL (`https://strktr.vercel.app/sops`) when composing email links.

This causes environment mismatch risk (preview/staging/custom domain), and can send recipients to the wrong host.

## Decision

Keep endpoint contract unchanged and resolve the SOP link base URL dynamically:

1. Use `NEXT_PUBLIC_APP_URL` when configured and valid.
2. Fallback to `new URL(request.url).origin`.

Then compose link as `${baseUrl}/sops`.

## Consequences

- Positive:
  - Correct link generation across environments/domains.
  - No API schema/route changes.
- Trade-off:
  - Misconfigured `NEXT_PUBLIC_APP_URL` now falls back silently to request origin.
- Rollback:
  - Revert this route-level resolution logic; no migration or contract rollback needed.
