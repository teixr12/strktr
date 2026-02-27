# ADR 0010 — Cloud-first Release Marker and DNS Resilience

- Status: Accepted
- Date: 2026-02-27
- Deciders: STRKTR Engineering

## Context
The project runs continuous delivery (`main` -> Vercel production) and safe Supabase migrations via GitHub Actions.
Local DNS/network instability can block CLI-based checks and create false deployment uncertainty.
We needed an environment-independent way to confirm production convergence and keep operations safe without touching business rules.

## Decision
1. Add an additive endpoint `GET /api/v1/ops/release` that exposes:
   - `version` (commit SHA),
   - environment metadata,
   - active feature flags snapshot.
2. Update `Release Ops` workflow to validate:
   - `/api/v1/ops/release` version matches merged SHA,
   - `/api/v1/health/ops` status is `ok`.
3. Keep cloud-first operational fallback:
   - if local DNS fails, releases continue via GitHub Actions + Vercel dashboard.
4. No schema change and no breaking API changes.

## Consequences
### Positive
- Deterministic release convergence check independent from local terminal DNS.
- Faster incident triage with explicit release marker in production audits.
- Safer rollout confidence while preserving existing CD flow.

### Negative
- New ops endpoint increases API surface (low risk).
- Requires maintaining parity between `health/ops` and `ops/release` expectations.

## Rollback
1. Revert workflow check to `health/ops` only.
2. Keep endpoint as non-critical additive route (or remove in a controlled PR).
3. No database rollback required.
