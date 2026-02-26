# ADR-0005: PDF storage com link seguro + versionamento de aprovação + SLA de reprovação

## Contexto

O módulo de cronograma já gerava PDF, porém retornava somente `base64` no payload da API.
No fluxo de aprovação cliente, reprovação ainda não impunha versionamento formal nem SLA operacional para revisão.

Com o produto live e multi-tenant, esses pontos geravam risco de:
- baixa rastreabilidade de documentos enviados;
- inconsistência de status após reprovação;
- falta de cadência operacional para reenvio.

## Decisão

1. PDF do cronograma passa a usar **Storage + Signed URL** como caminho padrão.
2. `base64` permanece apenas como **fallback de contingência**.
3. Reprovação de compra/orçamento ativa:
   - bloqueio de fechamento;
   - `blocked_reason` explícito;
   - SLA de revisão (24h) com alerta para `admin/manager`.
4. Reenvio para cliente exige **nova versão** (`approval_version` incremental), com vínculo ao approval anterior.
5. Calendário de cronograma suporta configuração custom por obra (`dias_uteis`, `feriados`) e afeta recálculo.

## Consequências

### Positivas
- documento entregue com link seguro e validade controlada;
- histórico auditável de versões de aprovação;
- redução de “aprovação fantasma” e maior previsibilidade operacional;
- agenda/alerts passam a refletir SLA de reprovação.

### Trade-offs
- aumento de complexidade no domínio financeiro (status internos de revisão/pendência);
- necessidade de migration aditiva para novos campos/índices e bucket de storage.

## Rollback

1. Desligar `NEXT_PUBLIC_FF_APPROVAL_GATE` para interromper bloqueios de aprovação.
2. Desligar `NEXT_PUBLIC_FF_CRONOGRAMA_PDF` para remover o fluxo novo de geração.
3. Manter schema (expand-only), sem rollback destrutivo.
