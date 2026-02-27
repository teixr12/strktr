# ADR 0007: Roadmap e Semi-Automação habilitados por padrão

- Status: Accepted
- Data: 2026-02-27

## Contexto
A ativação de `NEXT_PUBLIC_FF_PERSONAL_ROADMAP`, `NEXT_PUBLIC_FF_SEMI_AUTOMATION` e `NEXT_PUBLIC_FF_BEHAVIOR_PROMPTS` dependia de configuração explícita em ambiente. Com instabilidade de acesso à API da Vercel, essa etapa operacional atrasava rollout de funcionalidades já prontas.

## Decisão
As três flags passam a ser interpretadas como habilitadas por padrão quando ausentes, e só desabilitam quando definidas explicitamente como `false`.

- `NEXT_PUBLIC_FF_PERSONAL_ROADMAP !== 'false'`
- `NEXT_PUBLIC_FF_SEMI_AUTOMATION !== 'false'`
- `NEXT_PUBLIC_FF_BEHAVIOR_PROMPTS !== 'false'`

Também alinhamos os gatilhos server-side de automação em `leads`, `obras` e rejeição de aprovação no portal para a mesma semântica.

## Consequências
- Ganho operacional: reduz dependência imediata de configuração remota para ativar recursos prontos.
- Segurança de rollback: kill-switch permanece disponível por env (`false`).
- Observabilidade: `/api/v1/health/ops` expõe o estado das três flags com a semântica nova.

## Rollback
Definir qualquer uma dessas flags como `false` e fazer redeploy.
