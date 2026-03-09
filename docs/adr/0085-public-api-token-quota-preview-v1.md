# ADR 0085 — Public API token quota preview v1

## Status
Accepted — 2026-03-06

## Context
- `publicApiV1` already had:
  - internal clients
  - internal tokens
  - usage summaries by client
  - quota preview by client
- Tokens still inherited 100% of the client quota policy.
- That left a gap for blast-radius control at the token level.

## Decision
- Add optional token-specific quota overrides:
  - `rate_limit_per_minute_override`
  - `daily_quota_override`
  - `monthly_call_budget_override`
- Overrides are additive and nullable.
- Overrides can only reduce scope relative to the client policy.
- Token usage preview now evaluates against the effective token quota, not only the client quota.
- This remains:
  - internal-only
  - gated by `publicApiV1`
  - canary-safe
  - write-blocked in production by existing write governance

## Consequences
- Internal operators can model safer token-specific budgets before exposing any real external API.
- No public API contract was removed or renamed.
- No external token auth or live quota enforcement was introduced in this slice.
- Future enforcement can reuse the same effective quota model without redesigning the domain.
