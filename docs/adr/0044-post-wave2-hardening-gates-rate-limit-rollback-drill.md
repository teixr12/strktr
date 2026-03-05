# ADR-0044: Post-Wave2 Hardening for CI Gates, Public Endpoint Rate Limits, and Rollback Drill Evidence

- Status: Accepted
- Date: 2026-03-05
- Owners: Platform + Release Engineering
- Related: PR #90

## Context
Wave2 reached 100% rollout in production, but three reliability gaps remained:
1. Authenticated E2E business scenarios could be skipped when role/tenant env inputs were absent.
2. Public or public-sensitive endpoints (`/api/v1/portal/session/:token`, `/api/v1/monitoring/events`) lacked explicit request throttling.
3. Rollback evidence templates still referenced legacy UI flags instead of Wave2 module toggles.

At the same time, SSR hotspots still contained avoidable `select('*')` usage in core pages, increasing payload and governance drift risk.

## Decision
1. Enforce authenticated E2E matrix prerequisites in CI:
   - `E2E_MANAGER_BEARER_TOKEN`
   - `E2E_USER_BEARER_TOKEN`
   - `E2E_FOREIGN_OBRA_ID`
   CI now fails if these are absent, rather than silently skipping role/tenant scenarios.
2. Add rate limiting via shared primitive `enforceRateLimit` to:
   - `GET /api/v1/portal/session/:token`
   - `POST /api/v1/monitoring/events`
3. Add a dedicated rollback drill script:
   - `scripts/wave2-rollback-drill.sh`
   - exposed as `npm run ops:wave2:rollback-drill`
4. Update closeout automation and runbook with Wave2-specific drill instructions (`obraLogisticsV1`, `obraWeatherAlertsV1`).
5. Slim SSR `select('*')` in core internal pages (`obras`, `obras/[id]`, `perfil`, `configuracoes`) and tighten performance governance budget for `select('*')` count.

## Consequences
### Positive
- CI now enforces full authenticated regression coverage for role matrix and tenant isolation.
- Public endpoint abuse resistance is improved with standardized rate-limit headers and canonical 429 envelopes.
- Rollback drill evidence is aligned with active Wave2 flags and TTR documentation.
- Lower SSR payload pressure and tighter governance against query sprawl.

### Negative / Tradeoffs
- In-memory rate limiting is instance-local and not globally shared across all server instances.
- CI will fail fast if environment preparation is incomplete, increasing short-term pipeline strictness.

## Rollout / Rollback
- Rollout plan:
  1. Merge behind existing module flags (no breaking API changes).
  2. Run standard gates (`lint`, `build`, `validate:api-contracts`, `test:e2e`, `governance:all`).
  3. Publish operational evidence bundle (`audit:production`, drift, capture probe, rollback drill report).
- Rollback plan:
  1. Revert PR if unexpected CI or runtime impact appears.
  2. Keep Wave2 module flags as immediate kill-switches for functional rollback.
  3. Use deployment rollback as last resort.

## Notes
This ADR is additive and preserves `/api/v1` compatibility while raising reliability and release governance rigor for post-100% operations.
