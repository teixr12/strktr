# ADR 0039: Construction Docs AI generation must fail closed

- Date: 2026-03-04
- Status: Accepted
- Owners: Platform / Construction Docs

## Context

Construction Docs generation endpoints (`inspection`, `schedule`, `sop`) used fallback payloads when the AI provider was unavailable or returned invalid JSON.

This could persist pseudo-content and violates the product policy for critical document generation: no mock/fallback output in production.

## Decision

Adopt fail-closed behavior for AI generation in Construction Docs:

1. Remove fallback payload generation in AI adapter.
2. Throw typed `ConstructionDocsAiError` for:
   - provider not configured
   - provider failure
   - invalid model output
3. Map these errors in generation routes to HTTP `503` with canonical error envelope.
4. Keep all existing routes and payload contracts unchanged.

## Consequences

- Positive:
  - No document is persisted with synthetic fallback content.
  - Failure mode is explicit and observable to clients/operators.
- Trade-off:
  - Temporary AI outages surface directly to users as retriable errors.
- Rollback:
  - Revert this ADR patch to restore prior fallback behavior (not recommended by policy).
