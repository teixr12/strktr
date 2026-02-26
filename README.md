# STRKTR CRM

CRM/ERP operacional para pequenas e médias construtoras.

## Stack
- Next.js App Router + TypeScript
- Supabase (Auth + Database)
- Tailwind CSS
- Deploy em Vercel

## Setup local
1. Instale dependências:
```bash
npm install
```
2. Crie `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# opcionais
RESEND_API_KEY=
GOOGLE_GEMINI_API_KEY=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_VERIFY_TOKEN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=

# feature flags
NEXT_PUBLIC_FF_API_OBRAS_V2=false
NEXT_PUBLIC_FF_EXECUTION_RISK_ENGINE=false
NEXT_PUBLIC_FF_EXECUTION_ALERTS=false
NEXT_PUBLIC_FF_CHECKLIST_DUE_DATE=false
NEXT_PUBLIC_FF_PRODUCT_ANALYTICS=false
```
Use `.env.example` como base oficial para novos ambientes.
3. Rode em desenvolvimento:
```bash
npm run dev
```

## Scripts
- `npm run dev`: ambiente local
- `npm run build`: build de produção
- `npm run start`: start produção
- `npm run lint`: lint
- `npm run test:e2e`: smoke E2E (Playwright)
- `npm run validate:api-contracts`: valida padronização de contrato `/api/v1`
- `npm run governance:pr`: valida regras de governança para PR
- `npm run release:readiness`: executa checklist técnico completo de release
- `npm run baseline:report`: gera snapshot de baseline local em `docs/reports`
- `npm run audit:production`: gera auditoria de produção (health + Supabase audits)
- `npm run baseline:tag -- <tag>`: cria tag anotada de baseline (somente com árvore limpa)

Notas do `release:readiness`:
- Por padrão é estrito e falha se qualquer etapa falhar.
- Em ambientes com bloqueio de porta local, use `ALLOW_BIND_RESTRICTED_E2E_SKIP=1 npm run release:readiness`.
- Para validar E2E contra URL externa, use `PLAYWRIGHT_BASE_URL=https://<preview-ou-prod> npm run release:readiness`.

## Convenções de API v1
Envelope padrão:

Sucesso:
```json
{ "data": {}, "meta": { "contractVersion": "v1" }, "requestId": "..." }
```

Erro:
```json
{ "error": { "code": "STRING_CODE", "message": "..." }, "requestId": "..." }
```

## Endpoints v1 de Execução (novos)
- `GET /api/v1/obras/:id/execution-summary`
- `POST /api/v1/obras/:id/risks/recalculate`
- `GET /api/v1/obras/:id/etapas`
- `POST /api/v1/obras/:id/etapas`
- `DELETE /api/v1/obras/:id/etapas/:etapaId`
- `GET /api/v1/obras/:id/checklists`
- `POST /api/v1/obras/:id/checklists`
- `PATCH /api/v1/obras/:id/checklists/:checklistId`
- `DELETE /api/v1/obras/:id/checklists/:checklistId`
- `POST /api/v1/obras/:id/checklists/:checklistId/items`
- `PATCH /api/v1/obras/:id/checklists/:checklistId/items/:itemId`
- `DELETE /api/v1/obras/:id/checklists/:checklistId/items/:itemId`
- `POST /api/v1/obras/:id/checklists/items/:itemId/toggle`
- `POST /api/v1/obras/:id/etapas/:etapaId/status`
- `GET /api/v1/obras/:id/diario`
- `POST /api/v1/obras/:id/diario/notes`
- `POST /api/v1/leads/:id/next-action`
- `GET /api/v1/leads/sla`
- `GET /api/v1/transacoes/orcado-vs-realizado`
- `POST /api/v1/analytics/events`
- `GET /api/v1/health/ops`

### Payload adicional em `execution-summary`
```json
{
  "data": {
    "alerts": [{ "code": "BLOCKED_STAGE", "title": "1 etapa bloqueada", "severity": "high" }],
    "recommendedActions": [
      { "code": "RESOLVE_BLOCKED_STAGE", "title": "...", "cta": "Ir para Etapas", "severity": "high", "targetTab": "etapas" }
    ]
  }
}
```

## Segurança e escopo de dados
- APIs v1 usam `Authorization: Bearer <supabase_access_token>`.
- Escopo de segurança multi-tenant por `org_id` + RLS org-first.
- Operações do domínio de execução foram normalizadas para escopo `org_id`.

### Matriz de permissões de execução
- `can_update_stage`: `admin`, `manager`, `user`
- `can_toggle_checklist`: `admin`, `manager`, `user`
- `can_add_diary`: `admin`, `manager`, `user`
- `can_recalculate_risk`: `admin`, `manager`

## Códigos de erro canônicos
- `UNAUTHORIZED`
- `VALIDATION_ERROR`
- `FORBIDDEN`
- `NOT_FOUND`
- `DB_ERROR`

## Observabilidade
- `x-request-id` é propagado pelo middleware e retornado nas respostas de API.
- Logs estruturados em JSON nos handlers v1.
- Captura de erro client-side em `/api/v1/monitoring/events`.
- Eventos de produto em `eventos_produto` (quando a migration estiver aplicada).
- Sentry nativo configurado (`@sentry/nextjs`) via:
  - `instrumentation.ts`
  - `instrumentation-client.ts`
  - `sentry.server.config.ts`
  - `sentry.edge.config.ts`

## Rollout
- Use feature flags para liberar funcionalidades por etapa.
- Recomendado: deploy em preview Vercel antes de liberar em produção.
- Checklist de release big-bang: `docs/release-bigbang-checklist.md`.
- CI em `.github/workflows/ci.yml` (lint + build + API contract check + Playwright smoke).

## Governança de Engenharia
- Modelo operacional: `docs/governance/engineering-operating-model.md`
- Arquitetura oficial: `ARCHITECTURE.md`
- Contribuição: `CONTRIBUTING.md`
- Segurança: `SECURITY.md`
- ADRs: `docs/adr/*`
- Definição de pronto: `docs/governance/definition-of-done.md`
- Catálogo de domínios: `docs/governance/domain-catalog.md`
- Matriz de permissões: `docs/governance/permission-matrix.md`
- Política de cleanup seguro: `docs/governance/cleanup-policy.md`
- Configuração manual do GitHub: `docs/governance/github-settings.md`
- Plano operacional da semana: `docs/governance/next-7-days-plan.md`

## Runbooks Operacionais
- Release semanal: `docs/runbooks/weekly-release-train.md`
- Canary rollout: `docs/runbooks/release-canary-rollout.md`
- Migrações seguras Supabase: `docs/runbooks/supabase-migration-safety.md`
- Incidentes API/RLS/Cron: `docs/runbooks/incident-api-rls-cron.md`
- Rotação de credenciais: `docs/runbooks/credential-rotation.md`
- Limpeza de dados QA: `docs/runbooks/qa-data-cleanup.md`

## Migrations Supabase
- `supabase/migrations/20260225_product_events.sql`
- `supabase/migrations/20260225_org_first_backfill_rls.sql`
