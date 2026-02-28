# Runbook — Phase 2 Closeout (Leads/Finance Pagination + Role/Tenant E2E)

## Objetivo
Fechar Fase 2 sem regressão, validando paginação segura em módulos densos e matriz de segurança role/tenant.

## Escopo desta onda
1. Paginação UI em Leads e Financeiro via `NEXT_PUBLIC_FF_UI_PAGINATION_V1`.
2. SSR inicial reduzido para primeira página em Leads/Financeiro.
3. E2E estendido para role matrix e isolamento org.

## Pré-requisitos
- Build atual em produção com `/api/v1/health/ops` retornando `status=ok`.
- Secrets de E2E autenticado (opcional para matriz completa):
  - `E2E_BEARER_TOKEN`
  - `E2E_OBRA_ID`
  - `E2E_MANAGER_BEARER_TOKEN`
  - `E2E_USER_BEARER_TOKEN`
  - `E2E_FOREIGN_OBRA_ID`

## Passo-a-passo de rollout
1. Confirmar flag de paginação:
   - `NEXT_PUBLIC_FF_UI_PAGINATION_V1=true`
2. Rodar gates:
   - `npm run lint`
   - `npm run build`
   - `npm run validate:api-contracts`
   - `npm run test:e2e`
3. Smoke funcional:
   - Leads: paginação, drag/drop, next-action, detalhe.
   - Financeiro: paginação, filtros, create/edit/delete.
4. Smoke segurança:
   - role matrix (`admin/manager/user`) em finance/projetos/config/execution.
   - isolamento cross-org em obra foreign id.
5. Monitorar 2h:
   - 5xx `/api/v1/*`
   - erros JS/Sentry
   - p95 `/leads` e `/financeiro`

## Rollback
1. Desligar `NEXT_PUBLIC_FF_UI_PAGINATION_V1=false`.
2. Redeploy Vercel.
3. Revalidar smoke core.

## Critério de aceite
1. Nenhuma regressão em CRUD de Leads/Financeiro.
2. Paginação funcional em UI com metadados consistentes.
3. Role/tenant tests passando quando secrets completos estão disponíveis.
4. Sem aumento anormal de erro 5xx ou erro client-side.
