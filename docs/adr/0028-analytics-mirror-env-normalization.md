# ADR 0028: Analytics Mirror Env Normalization for Server-Side Events

- Status: Accepted
- Date: 2026-03-03

## Context

External analytics drift persisted specifically for `portal_approval_decision` while internal analytics remained correct. This event is emitted server-side in portal approval routes and mirrored to PostHog through `src/lib/telemetry.ts`.

Feature flags and environment diagnostics in other parts of the app already normalized env values with `trim().toLowerCase()`, but server mirror logic still used strict raw checks (`=== 'true'`). If env values include trailing whitespace/newline, health can show external analytics as enabled while mirror execution is effectively disabled.

## Decision

1. Normalize env values in server analytics mirror (`src/lib/telemetry.ts`) before:
   - evaluating analytics external flag,
   - resolving PostHog host and ingest token.
2. Apply the same env normalization in client adapter (`src/lib/analytics/adapter.ts`) for host/token resolution.
3. Align `/api/v1/health/ops` diagnostics with the same normalization strategy for flag/config readiness.

## Consequences

- Reduces false negative mirror behavior caused by env whitespace.
- Improves parity for server-side external events without changing internal source-of-truth.
- Keeps `/api/v1` contracts unchanged and preserves additive rollout via flags.

## Rollback

1. Set `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=false`.
2. Redeploy to keep only internal analytics while investigating external parity.
