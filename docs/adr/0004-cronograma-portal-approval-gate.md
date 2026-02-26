# ADR-0004: Cronograma avançado + Portal do cliente + Approval Gate obrigatório

- Status: Accepted
- Date: 2026-02-26
- Owners: Product + Platform
- Related: PR #8

## Context
O STRKTR já tinha base sólida de execução e tenancy, mas faltavam entregas de valor direto ao cliente final:
- cronograma de obra editável e recalculável;
- portal externo por obra com link mágico;
- aprovação de compras/orçamentos pelo cliente com bloqueio de fluxo;
- agenda operacional consolidada com tarefas críticas.

Sem essa camada, havia baixa previsibilidade para cliente final e risco de fechamento interno sem aprovação externa formal.

## Decision
Adotar implementação aditiva (sem quebra) com os seguintes blocos:
- novas tabelas e RLS org-first para cronograma/portal/aprovações/pdf;
- APIs v1 novas para cronograma (`items`, `recalculate`, `pdf`), portal (`session`, `comentarios`) e decisões (`approve`/`reject`);
- approval gate em `compras` e `orcamentos` para impedir status final sem decisão do cliente quando `exige_aprovacao_cliente=true`;
- agenda inteligente (`/api/v1/agenda/arquiteto`) e job diário (`/api/cron/alerts/daily`);
- entrega protegida por feature flags (`cronograma`, `pdf`, `portal`, `approval`, `agenda`).

## Consequences
### Positive
- Ganho real de campo: visibilidade de prazo, aprovação formal e comunicação com cliente.
- Redução de risco operacional: bloqueio explícito de fechamento sem aprovação.
- Compatibilidade com produção: schema aditivo + kill-switch por flags.

### Negative / Tradeoffs
- Aumenta complexidade operacional (novas tabelas, rotas e políticas RLS).
- Portal por link mágico exige monitoramento e rotação de tokens/credenciais.

## Rollout / Rollback
- Rollout: migration `expand`, deploy com flags off, validação interna, habilitação gradual.
- Rollback: desligar flags dos módulos novos; manter base legada funcional.

## Notes
- Não há `DROP TABLE/COLUMN` nesta onda.
- Sessão de portal é validada por `token_hash` + expiração + revogação.
