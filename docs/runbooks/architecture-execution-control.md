# Architecture Execution Control

This runbook exists to enforce the canonical STRKTR execution order:

1. certify the live core
2. roll out remaining Pod B modules
3. build platform hardening infrastructure
4. only then open runtime platform domains
5. leave regulated/platform-later and backlog work blocked until prerequisites exist

The governing rule is:

`certify -> harden -> expand`

## Source of Truth

- `GET /api/v1/ops/program`
- `GET /api/v1/health/ops`
- `GET /api/v1/ops/release`

`/api/v1/ops/program` exposes `executionControl`, which is the canonical machine-readable state for:

- current phase
- certification status
- allowed tasks now
- blocked tasks now
- structural gaps
- execution-order violations

## Local Validation

Run:

```bash
node scripts/validate-architecture-execution-order.mjs
```

Optional strict phase check:

```bash
ARCH_EXECUTION_EXPECT_PHASE=phase0_core_certification \
ARCH_EXECUTION_ALLOWED_CLASSIFICATIONS=core_certification \
node scripts/validate-architecture-execution-order.mjs
```

The validator fails if:

- `executionControl` is missing
- there are active execution-order violations
- the current phase does not match the expected phase
- a disallowed task appears in `allowedNow`

## Operational Rules

- Do not open a new user-facing rollout before Phase 0 closes.
- Do not deploy from the dirty primary workspace.
- Do not run rollout and rollback drills at the same time.
- Do not treat readiness endpoints or admin UI as proof of runtime readiness.
- Do not open `billing`, `publicApi`, `agent`, or `openBanking` before platform hardening exists.

## Phase 0 — Core Certification

Allowed:

- validate live release traceability
- confirm auth strict E2E as stable gate
- run rollback drills
- publish the final core closeout

Blocked:

- Pod B rollouts
- platform hardening rollout
- runtime foundation rollout
- regulated/platform-later rollout

## Phase 1 — Pod B Rollout

Order:

1. `financeDepthV1`
2. `supplierManagementV1`
3. `bureaucracyV1`
4. `emailTriageV1`

Pattern:

- `QA allowlist -> 25% -> 100%`

## Phase 2 — Platform Hardening

Required order:

1. durable job / worker control plane
2. distributed idempotency
3. distributed rate limiting
4. minimal workflow / event backbone
5. search / index layer

These are prerequisites for public/runtime platform work.

## Phase 3 — Runtime Foundation

Only after platform hardening:

1. `Billing (V1)`
2. `Public API (V1)`
3. `Integrations Hub (V1)`
4. `Referral (V1)`

Readiness endpoints do not count as runtime readiness.

## Phase 4 — Regulated / Platform Later

Only after runtime foundation and compliance minimum:

1. `Agent Ready (V1)`
2. `Super Admin (V1)`
3. `Big Data (V1)`
4. `Open Banking (V1)`
