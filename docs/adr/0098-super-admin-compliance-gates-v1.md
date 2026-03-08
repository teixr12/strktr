# ADR 0098: Super Admin Compliance Gates V1

## Context
- `superAdminV1` already exposes readiness, rollout governance, billing governance and domain health.
- Regulated domains such as `billingV1`, `publicApiV1`, `superAdminV1`, `agentReadyV1`, `bigDataV1` and `openBankingV1` still need a read-only control surface that answers one operational question: what is still blocking general release?
- The program already tracks `requiresComplianceGate` in `/src/server/program/program-status.ts`, but there was no dedicated summary for blockers vs safe containment.

## Decision
- Add `GET /api/v1/super-admin/compliance-gates`.
- Keep it:
  - read-only
  - `404-safe`
  - behind `superAdminV1` + org canary
- Reuse the program registry and combine it with a small set of runtime signals:
  - distributed rate limit readiness
  - webhook signing readiness
  - service role readiness
  - explicit placeholders for audit log, consent workflow and anonymization
- Treat regulated modules that are still contained by rollout as `attention`, not `blocked`, unless they are already `live` with open compliance blockers.

## Consequences
- Super Admin now has a single place to inspect whether regulated domains are merely incomplete or dangerously exposed.
- The new panel improves release discipline without opening any write surface.
- No migration is needed.
- No production behavior changes unless `superAdminV1` is enabled for the org.
