# Wave2 Rollback Drill

- GeneratedAt: 2026-03-05T08:37:19Z
- Operator: rodrigoteixeiraadmin
- DrillScope: NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1 + NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1

## Step 0 — Baseline Snapshot
```json
```

## Step 1 — Toggle OFF
1. Set `NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1=false`.
2. Set `NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1=false`.
3. Redeploy production.
4. Run smoke for `/obras/:id` (location + weather + logistics + alerts).

Paste health snapshot after OFF toggle below:
```json
```

## Step 2 — Toggle ON
1. Set `NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1=true`.
2. Set `NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1=true`.
3. Redeploy production.
4. Re-run Wave2 smoke.

Paste health snapshot after ON restore below:
```json
```

## TTR Record
- Toggle OFF start: [fill]
- Toggle OFF healthy: [fill]
- TTR OFF (seconds): [fill]
- Toggle ON start: [fill]
- Toggle ON healthy: [fill]
- TTR ON (seconds): [fill]

## Acceptance
- [ ] `health/ops=ok` after OFF
- [ ] `health/ops=ok` after ON
- [ ] Wave2 smoke passed after OFF
- [ ] Wave2 smoke passed after ON
- [ ] No spike in 5xx or JS errors during drill
