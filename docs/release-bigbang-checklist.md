# STRKTR Big-Bang Sprint Release Checklist

## Pre-release (D-1)
- `npm run lint` sem warnings/errors.
- `npm run build` validado no ambiente CI/preview.
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

## Pós-release (0h-48h)
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
