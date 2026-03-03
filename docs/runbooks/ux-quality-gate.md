# UX Quality Gate Runbook

## Objetivo

Garantir consistência mínima de UX nos módulos críticos antes de cada release:
- loading/skeleton
- empty state
- erro/retry
- feedback de ação (`toast`)

## Como executar

```bash
npm run audit:ux-quality
```

Resultado:
- gera relatório em `docs/reports/ux-quality-audit-<timestamp>.md`
- status padrão: informativo (`pass` ou `warn`)

## Modo estrito (para CI dedicado)

```bash
UX_AUDIT_STRICT=1 npm run audit:ux-quality
```

Com `UX_AUDIT_STRICT=1`, o comando falha se houver falhas críticas:
- ausência de estado de loading
- ausência de feedback de ação

## Política recomendada

1. Rodar o audit em todo PR de UX core.
2. Tratar `warn` como bloqueador para módulos novos.
3. Validar manualmente os itens com score baixo antes do merge.

## Rollback

Se o gate causar ruído operacional:
1. remover temporariamente a chamada no `release-readiness.sh`;
2. manter auditoria manual via `npm run audit:ux-quality`;
3. ajustar regras do script e reativar no ciclo seguinte.
