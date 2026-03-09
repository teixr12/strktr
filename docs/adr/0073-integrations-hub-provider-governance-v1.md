# ADR 0073: Integrations Hub Provider Governance V1

- Status: accepted
- Date: 2026-03-06

## Context

`integrationsHubV1` already exposed a read-only catalog of providers based on environment readiness, but Pod C still lacked an internal control layer per tenant to register rollout intent, operational owner, callback target, and governance notes for each provider. Opening real connectors later without this persisted layer would push provider policy into ad hoc env-only logic.

## Decision

Add a tenant-scoped internal configuration layer for providers:

- keep `GET /api/v1/integrations/hub` as the catalog/readiness surface
- add `GET/PATCH /api/v1/integrations/hub/settings`
- persist settings in `public.integration_provider_settings`
- block writes in production by default; allow only preview/development unless explicitly overridden
- keep the entire domain `404-safe` when the feature or org canary is off

This phase does not store third-party secrets and does not connect any provider.

## Consequences

Positive:

- Gives the platform a real provider governance layer before opening write-capable integrations.
- Keeps all changes additive and org-scoped.
- Preserves the existing kill switch, canary, health and audit model.

Tradeoffs:

- Production write paths remain intentionally blocked.
- Providers still depend on separate secret management and connector adapters in later phases.
