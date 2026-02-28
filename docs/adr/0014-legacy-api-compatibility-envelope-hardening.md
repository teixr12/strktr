# ADR 0014 — Legacy API Compatibility Envelope Hardening

- Status: Accepted
- Date: 2026-02-28
- Deciders: STRKTR Engineering

## Context
Some operational endpoints outside `/api/v1` were still returning ad-hoc JSON payloads without
`requestId` and without consistent error metadata:
- `/api/ai/calculate`
- `/api/webhooks`
- `/api/whatsapp/webhook`

These routes are in active use and cannot break existing consumers expecting legacy fields
such as `success`, `items`, or `error` as string.

## Decision
1. Add a compatibility response helper:
   - `src/lib/api/legacy-compat-response.ts`
2. Keep legacy payload keys intact while adding additive fields:
   - `data`
   - `meta.contractVersion`
   - `requestId`
   - `errorDetail` on failure
3. Harden `/api/webhooks` with optional auth token check:
   - enforce only when `WEBHOOK_DISPATCH_TOKEN` is configured.

## Consequences
### Positive
- Better observability and support diagnostics (`requestId`) in legacy routes.
- No contract break for existing clients still reading legacy fields.
- Optional security hardening for webhook dispatch trigger.

### Negative / Tradeoffs
- Temporary coexistence of legacy and canonical-like fields increases payload size slightly.
- Full migration to pure `/api/v1` style remains a later step.

## Rollout / Rollback
- Rollout: merge and deploy normally with existing CI gates.
- Rollback:
  1. revert legacy compatibility helper usage in affected routes,
  2. redeploy,
  3. keep optional `WEBHOOK_DISPATCH_TOKEN` unset if compatibility issue appears.
