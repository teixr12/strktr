# ADR 0008: UI Wave 2 com flags por módulo e default-on no beta

- Status: Accepted
- Data: 2026-02-27

## Contexto
A Wave 2 de UI/UX foi definida com rollout big bang, mas com necessidade de rollback rápido sem tocar backend. A base já tinha `NEXT_PUBLIC_FF_UI_TAILADMIN_V1` e algumas flags parciais.

## Decisão
Padronizamos flags de UI por módulo com semântica `enabled by default` (desabilita somente com `false`), preservando kill-switch global:

- `NEXT_PUBLIC_FF_UI_TAILADMIN_V1`
- `NEXT_PUBLIC_FF_UI_V2_OBRAS`
- `NEXT_PUBLIC_FF_UI_V2_LEADS`
- `NEXT_PUBLIC_FF_UI_V2_DASHBOARD`
- `NEXT_PUBLIC_FF_UI_V2_FINANCEIRO`
- `NEXT_PUBLIC_FF_UI_V2_COMERCIAL`
- `NEXT_PUBLIC_FF_UI_V2_COMPRAS`
- `NEXT_PUBLIC_FF_UI_V2_PROJETOS`
- `NEXT_PUBLIC_FF_UI_V2_ORCAMENTOS`
- `NEXT_PUBLIC_FF_UI_V2_EQUIPE`
- `NEXT_PUBLIC_FF_UI_V2_AGENDA`
- `NEXT_PUBLIC_FF_UI_V2_KB`
- `NEXT_PUBLIC_FF_UI_V2_CONFIG`
- `NEXT_PUBLIC_FF_UI_V2_PERFIL`
- `NEXT_PUBLIC_FF_UI_V2_OBRA_TABS`

Também ampliamos `/api/v1/health/ops` para expor essas flags e facilitar monitoramento operacional pós-go-live.

## Consequências
- Big bang sem depender de configuração manual extensa em Vercel.
- Rollback segmentado por módulo via env var.
- Sem alterações de contrato funcional de negócio/API principal.

## Rollback
1. Desligar módulo específico com `NEXT_PUBLIC_FF_UI_V2_* = false`.
2. Se necessário, desligar tudo com `NEXT_PUBLIC_FF_UI_TAILADMIN_V1 = false`.
3. Redeploy no Vercel.
