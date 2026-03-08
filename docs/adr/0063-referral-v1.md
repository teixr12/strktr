# 0063 — Referral V1

- Date: 2026-03-06
- Status: accepted

## Context

O backlog prevê um programa de indicação, mas ainda não existia domínio real para cadastrar, rastrear e evoluir indicações por organização.

Abrir landing pública, payout ou billing acoplado agora aumentaria risco sem necessidade.

## Decision

Criar `referralV1` como domínio interno mínimo, atrás de `feature flag + canário por organização`, com:

1. tabela `referral_invites` com `org_id`, `code`, status, recompensa e notas;
2. `GET/POST /api/v1/referrals` e `GET/PATCH /api/v1/referrals/:id`;
3. página interna `/indicacoes` para gestão operacional;
4. sem landing pública, sem payout automático e sem billing acoplado nesta fase.

## Consequences

- O produto ganha backend real para indicações sem depender de planilhas.
- O rollout continua seguro e reversível.
- Próximas fases podem adicionar claim público, tracking de conversão e reward settlement sem quebrar o domínio base.
