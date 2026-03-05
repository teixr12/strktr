# ADR 0042: Wave2 Obra Weather + Map + Logistics (Flag-First, Additive)

- Status: Accepted
- Date: 2026-03-05
- Deciders: STRKTR Product + Engineering

## Context

Wave2 requires climate, map, and logistics capabilities on obra detail without breaking the core domain or existing `/api/v1` contracts. The platform already uses additive migrations, feature flags, and rollback by deploy/flag. We must preserve tenant isolation (`org_id`) and avoid coupling core CRUD to external providers.

## Decision

1. Add a new additive persistence table `obra_geolocations` with RLS by `org_id`.
2. Add additive APIs:
   - `GET /api/v1/obras/:id/location`
   - `PATCH /api/v1/obras/:id/location`
   - `GET /api/v1/obras/:id/weather`
   - `POST /api/v1/obras/:id/logistics/estimate`
3. Integrate optional weather/logistics context into existing `GET /api/v1/obras/:id/alerts` payload without changing required fields.
4. Use free managed providers through adapters:
   - weather: Open-Meteo
   - routing: OpenRouteService when key exists, fallback to OSRM
5. Keep all Wave2 UI behind new flags (default OFF):
   - `NEXT_PUBLIC_FF_OBRA_WEATHER_V1`
   - `NEXT_PUBLIC_FF_OBRA_MAP_V1`
   - `NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1`
   - `NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1`
6. Apply UI as an additive first-fold panel in obra detail; no tab or routing changes required.

## Consequences

### Positive

1. Vertical E2E capability for weather/map/logistics with minimal blast radius.
2. Tenant-safe geolocation persistence and auditable RLS coverage.
3. Fast rollback via flags if provider instability appears.

### Tradeoffs

1. External provider quality/latency may vary.
2. Logistics estimation depends on location completeness and provider availability.
3. Alerts route can become heavier when weather-alerts flag is ON.

## Rollout and rollback

1. Rollout in waves with module flags OFF by default.
2. Validate canary with smoke and security matrix before promotion.
3. Rollback by disabling module flags and redeploy.
4. Keep migration additive; no destructive rollback.

