# 0100 — Release Traceability and Safe Print Preview

## Status
Accepted

## Context

Production release metadata was falling back to `version: "local"` and `branch: null` whenever
the runtime environment did not expose `VERCEL_GIT_*` variables. That weakened operational
traceability in `health/ops` and `ops/release`, even when the deployed code was correct.

The SOP print flow also relied on `window.open('', ...)` plus `document.write(...)` to build the
print document. The flow worked, but it is a fragile browser pattern and an avoidable security
hygiene issue.

## Decision

1. Generate release metadata at build time into a local artifact and use it as a fallback when
   runtime Vercel git metadata is absent.
2. Expose the resolved release metadata in both `health/ops` and `ops/release`.
3. Replace `document.write(...)` in the SOP print preview with a Blob-backed print document and
   lifecycle-based cleanup.

## Consequences

- Production health and release endpoints now preserve traceability even for deployments that do
  not inject `VERCEL_GIT_*` variables at runtime.
- SOP print preview keeps the same user behavior without relying on HTML injection into a live
  document.
- No breaking API changes are introduced. The new release fields are additive.
