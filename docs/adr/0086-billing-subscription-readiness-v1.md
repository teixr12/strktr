# ADR 0086 — Billing subscription readiness v1

## Status
Accepted — 2026-03-06

## Context
- `billingV1` already had:
  - provider readiness
  - admin settings
  - checkout draft sandbox
  - internal plan catalog
  - provider governance
- There was still no org-scoped object capturing whether a tenant is operationally ready to start a subscription rollout.
- That gap made billing readiness too provider-centric and not explicit enough for commercial/compliance gating by organization.

## Decision
- Add `billing_subscription_readiness` as an org-scoped readiness record.
- Expose it through `GET/PATCH /api/v1/billing/subscription-readiness`.
- Persist only operational readiness data:
  - selected plan
  - preferred provider
  - billing/finance owners
  - company legal/address context
  - launch mode
  - KYC status
  - internal terms acceptance
  - notes
- Keep the route:
  - behind `billingV1`
  - canary-safe
  - write-blocked in production by the existing billing write gate

## Consequences
- Billing now has a tenant-level readiness layer separate from provider configuration.
- No public checkout or live subscription flow was introduced.
- Future checkout/subscription rollout can use this object as the org-level gate before opening write-capable billing.
