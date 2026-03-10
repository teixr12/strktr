# Finance Depth V1 Rollout Validation

## Objetivo
Validar o rollout de `financeDepthV1` usando a superfície real do DRE financeiro, sem depender de mocks nem de escrita destrutiva.

## Pré-requisitos
- `E2E_BEARER_TOKEN`
- opcional: `STRKTR_BASE_URL`
- opcional: `FINANCE_DEPTH_V1_EXPECT_ENABLED=true` para exigir que a feature esteja realmente acessível para a org/token usado
- opcional: `FINANCE_DEPTH_V1_MONTHS=6` para ajustar a janela do DRE (mínimo 3, máximo 12)

## Execução
```bash
npm run ops:finance-depth-v1:validate
```

## O que é validado
1. `GET /api/v1/health/ops`
2. `GET /api/v1/financeiro/dre?months=<n>`

## Comportamento
- `pass`: domínio acessível e payload coerente com o contrato atual
- `skip`: env faltando ou domínio ainda escondido para a org/token usado
- `fail`: erro real de contrato, flag incorreta ou indisponibilidade indevida

## Saída
- relatório em `docs/reports/finance-depth-v1-rollout-validate-<timestamp>.md`

## Uso recomendado
1. rodar antes de abrir `QA allowlist`
2. rodar antes de `allowlist -> 25%`
3. rodar antes de `25% -> 100%`
