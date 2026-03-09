# 0084 — Billing Provider Governance V1

- Status: Accepted
- Date: 2026-03-06

## Context

`billingV1` already had:

- readiness
- admin settings
- checkout draft sandbox
- internal plan catalog

The missing internal governance gap was provider-specific metadata per organization:

- rollout posture
- operational readiness
- account reference
- webhook hint
- accepted currencies
- payment rail support

This needed to remain additive and sandbox-only, without persisting secrets or opening real billing writes in production.

## Decision

Add:

- `billing_provider_settings` table
- `GET/PATCH /api/v1/billing/providers`

The route is gated by:

- `billingV1`
- org canary
- existing billing write restrictions in production

Only operational metadata is persisted. No provider secret is stored in this slice.

## Consequences

### Positive

- Billing now has a real internal source of truth for provider readiness and rollout posture.
- Product and ops can align on Stripe/Mercado Pago without opening checkout or subscriptions.
- Rollback remains trivial because the slice is additive and still sandbox-only.

### Negative

- Another admin surface exists before the real billing runtime is implemented.
- Provider governance can drift from actual secret configuration if operators do not keep it updated.

## Rollout

- local-only in this slice
- no production deploy
- no production flag change
