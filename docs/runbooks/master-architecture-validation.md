# Master Architecture Validation

This runbook validates STRKTR against the canonical architecture order:

1. core certification
2. Pod B rollout
3. platform hardening
4. runtime foundation
5. regulated/platform later

The report is intentionally conservative. It does not treat:

- feature flags
- admin shells
- readiness endpoints

as proof of runtime completeness.

## Command

```bash
node scripts/validate-master-architecture.mjs
```

Or via npm:

```bash
npm run ops:master-architecture:validate
```

## Inputs

Optional environment overrides:

- `ARCH_VALIDATION_BASE_URL`
- `ARCH_VALIDATION_PROGRAM_JSON`
- `ARCH_VALIDATION_HEALTH_JSON`
- `ARCH_VALIDATION_RELEASE_JSON`

Use snapshots when network access is unavailable or when validating a fixed point-in-time payload.

## Output

Writes a report to:

`docs/reports/master-architecture-validation-<timestamp>.md`

The report includes:

- current system state
- phase alignment
- platform infrastructure validation
- runtime safety check
- automation/event system analysis
- data flywheel status
- moat development status
- architecture drift detection
- prioritized next build steps
- final verdict

## Interpretation

- `Core certification` must close before any new user-facing rollout.
- `Platform hardening` must close before any public/runtime platform expansion.
- `Foundation only` means merged/admin/readiness exists, but runtime-real does not.
- A module or domain can exist in code and still be operationally blocked.
