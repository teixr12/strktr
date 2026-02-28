# Runbook — Phase 1 Analytics Rollout (Internal + External Fail-safe)

## Objetivo
Ativar analytics externo (PostHog) sem interromper o tracking interno já existente.

## Pré-requisitos
- Deploy em produção com commit da Phase 1.
- `NEXT_PUBLIC_FF_PRODUCT_ANALYTICS=true`.
- Secrets configurados no Vercel:
  - `NEXT_PUBLIC_POSTHOG_KEY`
  - `NEXT_PUBLIC_POSTHOG_HOST` (ex: `https://app.posthog.com`)
- Secrets no GitHub Actions (auditoria diária):
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_REF`
  - `POSTHOG_PROJECT_ID`
  - `POSTHOG_API_KEY`
  - `POSTHOG_HOST` (opcional)
- Flag externa iniciando em `false`:
  - `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=false`

Se `NEXT_PUBLIC_POSTHOG_KEY` ou `NEXT_PUBLIC_POSTHOG_HOST` não existir em produção:
1. manter `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=false`;
2. registrar issue operacional bloqueante;
3. manter analytics interno como source of truth até regularização.

## Rollout seguro
1. Confirmar health:
   - `GET /api/v1/health/ops`
   - Verificar `flags.productAnalytics=true` e `flags.analyticsExternalV1=false`.
2. Ligar `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=true` apenas na organização piloto.
3. Rodar smoke de negócio:
   - dashboard,
   - leads (create/move),
   - obra (etapa/checklist/risk),
   - portal (invite/comment/approve/reject).
4. Monitorar por 2-4h:
   - erros JS/Sentry,
   - 5xx em `/api/v1/*`,
   - volume de eventos internos e externos.
5. Comparar por 7 dias:
   - desvio de contagem interno vs externo alvo `< 5%`.
   - executar diariamente:
     - `npm run audit:analytics-drift`
   - validar relatório em `docs/reports/analytics-drift-*.md`.
6. Se estável, liberar geral.

## Automação diária de drift
- Workflow: `.github/workflows/analytics-drift-daily.yml`
- Agendamento: diário (03:15 UTC) + `workflow_dispatch`.
- Saída: artifact `analytics-drift-report` contendo `docs/reports/analytics-drift-*.md`.

## Rollback
1. Setar `NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1=false`.
2. Redeploy Vercel.
3. Manter provider interno ativo (sem mudança de banco).

## Critério de aceite
- Fluxos core sem regressão funcional.
- Tracking interno contínuo.
- Tracking externo ativo e estável após canário.
- Drift diário (24h) com `MaxAbsDriftPct <= 5` por 7 dias consecutivos.
