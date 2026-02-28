# Post-Wave 2 Operational Closure Runbook

## Goal
Close Wave 2 with production evidence, controlled monitoring, and rollback readiness without changing API, database schema, or business rules.

## D0 (Today) - Functional Acceptance + Stability Window
1. Run technical gates:
   - `npm run release:readiness`
   - `npm run audit:production`
2. Generate closure report:
   - `npm run ops:post-wave2`
3. Execute manual acceptance matrix (desktop/mobile + light/dark):
   - Dashboard
   - Obras (lista + detalhe + abas)
   - Leads (kanban + interação)
   - Financeiro, Compras, Projetos, Orçamentos
   - Equipe, Agenda, KB, Configurações, Perfil
4. Monitor for 2-4 hours:
   - `/api/v1/health/ops`
   - JS/Sentry errors
   - `/api/v1/*` 5xx
   - p95 for core pages

## D0 Rollback Drill (Controlled)
1. Disable one module UI flag in Vercel (`false`).
2. Redeploy and validate fallback.
3. Re-enable flag and validate again.
4. Keep global kill-switch ready:
   - `NEXT_PUBLIC_FF_UI_TAILADMIN_V1=false`

## D1 - Quick UX Fixes + Security Rotation
1. Fix only P0/P1 UX issues:
   - mobile overflow
   - dark-mode contrast
   - hidden CTA
   - confusing empty/loading/error states
2. Rotate credentials:
   - `VERCEL_TOKEN`
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_PASSWORD`
3. Re-run:
   - `npm run release:readiness`
   - `npm run ops:post-wave2`

## D2 - Sprint Closure
1. Publish short closure note:
   - shipped scope
   - incidents
   - key metrics before/after
   - next adjustments
2. If second reviewer is active, restore:
   - `required_approving_review_count=1`

## Rollback Order (Strict)
1. Disable module flag (`NEXT_PUBLIC_FF_UI_V2_*`).
2. Redeploy and verify.
3. If still unstable, disable global UI switch.
4. Only then rollback deployment.

## Definition of Done (Operational)
- Manual acceptance complete with evidence.
- 2-4h monitoring finished with no critical regressions.
- Rollback drill executed.
- Credential rotation executed and validated.
