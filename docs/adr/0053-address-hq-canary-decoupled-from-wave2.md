# ADR 0053: Address/HQ Canary Decoupled from Legacy Wave2 Rollout

## Status
Accepted — March 5, 2026

## Context
- `weather`, `map`, `logistics`, and `weatherAlerts` are already live in production with `FF_OBRA_WAVE2_CANARY_PERCENT=100`.
- The current lot introduced `NEXT_PUBLIC_FF_OBRA_ADDRESS_UX_V2` and `NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1`.
- The first rollout design reused the same `FF_OBRA_WAVE2_CANARY_PERCENT` gate for all Wave2 obra features.
- Lowering that shared percent to canary `address/hq` would regress already-live Wave2 features for most organizations.

## Decision
1. Keep legacy Wave2 canary envs for:
   - `weather`
   - `map`
   - `logistics`
   - `weatherAlerts`
2. Introduce dedicated canary envs for:
   - `addressV2`
   - `hqRouting`
3. New envs:
   - `FF_OBRA_ADDRESS_HQ_CANARY_PERCENT`
   - `FF_OBRA_ADDRESS_HQ_CANARY_ORGS`
4. When the dedicated address/HQ envs are configured, `addressV2` and `hqRouting` use them.
5. When the dedicated envs are absent, `addressV2` and `hqRouting` fall back to the legacy Wave2 canary behavior for backward compatibility.
6. Server-rendered obra/configuration screens must receive org-scoped access booleans so the UI rollout matches the API rollout.

## Consequences
- Safe canary for `address/hq` without regressing existing Wave2 rollout.
- Backward-compatible behavior for environments that have not yet configured the new envs.
- Slightly more operational complexity because address/HQ rollout becomes independently controllable.
