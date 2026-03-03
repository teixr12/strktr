# ADR 0025: PostHog Capture Token Resolution and Health Readiness

- Status: Accepted
- Date: 2026-03-03

## Context

External analytics mirror was enabled, but drift reports showed missing events for
`portal_approval_decision` in PostHog while internal analytics continued to persist.
The previous capture path accepted `POSTHOG_API_KEY` as a capture key fallback.
In practice, this key is commonly used for query/audit access and is not guaranteed
to be a valid ingest token.

## Decision

1. Resolve PostHog capture key with ingest-focused precedence:
   - `NEXT_PUBLIC_POSTHOG_KEY`
   - `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`
   - `POSTHOG_PROJECT_TOKEN`
   - `POSTHOG_PROJECT_API_KEY`
2. Keep `POSTHOG_API_KEY` for query/audit workflows only (for example, drift reports).
3. Update `/api/v1/health/ops` readiness check to validate ingest token presence,
   not query key presence.
4. Keep all changes additive and backward compatible with existing `/api/v1` contracts.

## Consequences

- Reduces false-positive readiness where external analytics appears configured but
  ingest path is invalid.
- Improves reliability of server-side PostHog mirror for portal approval events.
- No schema, route, or response-contract changes.
- Rollback remains simple via `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=false`.
