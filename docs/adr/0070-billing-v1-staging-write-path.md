# ADR 0070: Billing V1 Staging Write Path

## Context

`billingV1` already had a read-only readiness surface for providers, compliance gates and planned checkout flows. The next safe step is enabling internal configuration writes without exposing real billing behavior in production.

## Decision

Add an internal write-capable settings surface for billing that:

- stays behind `billingV1` + org canary
- adds a dedicated settings route at `/api/v1/billing/settings`
- persists internal billing admin settings in `billing_admin_settings`
- is blocked in production by runtime stage
- remains available in development and preview/staging for internal iteration

## Consequences

- internal teams can configure default provider, sandbox mode, trial days and pricing drafts before checkout exists
- production remains read-only until compliance, webhook policy and provider rollout are ready
- no `/api/v1` contract is broken; the new route is additive and `404-safe` behind feature gating
