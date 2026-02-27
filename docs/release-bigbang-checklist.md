# STRKTR Big-Bang Sprint Release Checklist

## Pre-release (D-1)
- `npm run lint` sem warnings/errors.
- `npm run build` validado no ambiente CI/preview.
- `quality`, `pr-governance`, `secrets-scan` e `Vercel` verdes no PR.
- Smoke dos fluxos críticos:
  - login
  - criar obra
  - criar etapa
  - concluir item de checklist
  - registrar nota no diário
  - criar lead e gerar next-action
- Revisão de rotas `/api/v1` com envelope padrão (`data`/`error` + `requestId`).
- Feature flags definidas para o sprint no Vercel.

## Release window
- Freeze de escrita para migração (quando houver mudança de schema crítica).
- Rodar migrations no Supabase.
- Validar contagens pré/pós migração.
- Deploy em produção via Vercel.
- Confirmar convergência da `main` no `health/ops` (campo `version` = SHA merged).
- Confirmar convergência no `ops/release` (campo `version` = SHA merged).

## Pós-release (0h-48h)
- Workflow `Release Ops` concluído com sucesso.
- Monitorar erros por rota (`/api/v1/...`) e taxa de falha.
- Monitorar latência p95 das rotas críticas de Obras e Leads.
- Verificar eventos de produto:
  - `EtapaStatusChanged`
  - `ChecklistItemToggled`
  - `RiskRecalculated`
  - `LeadNextActionSuggested`
- Critério de rollback:
  - aumento de erro crítico acima do baseline definido
  - quebra de fluxo core (obras/leads/financeiro)
