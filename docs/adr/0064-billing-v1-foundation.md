# 0064 — Billing V1 Foundation

- Date: 2026-03-06
- Status: accepted

## Context

O roadmap exige Stripe, Mercado Pago, checkout transparente e gestão de assinatura, mas abrir cobrança sem readiness explícito cria risco alto de compliance, reconciliação e suporte.

Ainda não existe produto completo de billing com webhooks reconciliados, checkout write-capable e camada legal final.

## Decision

Criar `billingV1` como fundação read-only, atrás de `feature flag + canário por organização`, com:

1. `GET /api/v1/billing/readiness` protegido e `404-safe` fora do rollout.
2. Página interna `/billing` com perfil da organização, readiness de provedores e checklist mínimo.
3. Sem criação de assinatura, sem cobrança ativa e sem checkout write-capable nesta fase.
4. General release continua bloqueado até fechar webhook, rate limit, perfil fiscal e textos legais.

## Consequences

- O time ganha visibilidade operacional do readiness de billing sem expor cobrança prematuramente.
- Stripe e Mercado Pago podem evoluir depois sem quebrar o domínio base.
- O rollout continua controlado e reversível.
