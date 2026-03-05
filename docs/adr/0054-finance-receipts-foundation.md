# ADR 0054: Finance Receipts Foundation

- Status: Accepted
- Date: 2026-03-05

## Context

O m\u00f3dulo de financeiro j\u00e1 possui CRUD real de `transacoes`, mas ainda n\u00e3o havia um fluxo persistido para:

- upload privado de recibos e notas,
- leitura assistida por IA com revis\u00e3o obrigat\u00f3ria,
- v\u00ednculo de comprovantes \u00e0 transa\u00e7\u00e3o sem quebrar o fluxo atual.

O requisito operacional \u00e9 adicionar esse fluxo sem alterar contratos legados de `/api/v1/transacoes` e sem depender de fallback fake quando a IA estiver indispon\u00edvel.

## Decision

Adotar um modelo em duas etapas:

1. `receipt intake` desacoplado da transa\u00e7\u00e3o
2. v\u00ednculo opcional do intake \u00e0 transa\u00e7\u00e3o no momento da cria\u00e7\u00e3o ou por endpoint dedicado de anexos

### Data model

- Nova tabela `transacao_receipt_intakes`
  - armazena o arquivo privado, metadata, payload de IA e status de revis\u00e3o
- Nova tabela `transacao_anexos`
  - representa o v\u00ednculo de um arquivo privado a uma transa\u00e7\u00e3o
- Novo bucket privado `finance-receipts`

### API shape

- `POST /api/v1/transacoes/receipts/intake`
- `GET /api/v1/transacoes/receipts/:id`
- `GET/POST /api/v1/transacoes/:id/anexos`
- `DELETE /api/v1/transacoes/:id/anexos/:attachmentId`
- `POST /api/v1/transacoes` continua backward-compatible e aceita `receipt_intake_id` opcional

### UX policy

- Flags can\u00f4nicas:
  - `NEXT_PUBLIC_FF_FINANCE_RECEIPTS_V1`
  - `NEXT_PUBLIC_FF_FINANCE_RECEIPT_AI_V1`
- A IA apenas sugere preenchimento.
- Nenhum valor cont\u00e1bil \u00e9 persistido sem confirma\u00e7\u00e3o do usu\u00e1rio.
- Se a IA falhar, o upload continua v\u00e1lido e o fluxo segue manual.

## Consequences

### Positive

- Mant\u00e9m o CRUD tradicional intacto.
- Isola falhas de IA do fluxo financeiro principal.
- Permite rollout seguro por flag.
- Preserva multi-tenant via `org_id` + RLS em todas as novas tabelas.

### Negative

- Pode haver `receipt intakes` n\u00e3o vinculados quando o usu\u00e1rio faz upload e cancela o modal.
- O fluxo de edi\u00e7\u00e3o ainda n\u00e3o reconcilia automaticamente campos cont\u00e1beis j\u00e1 preenchidos com um novo recibo.

## Rollout

1. Merge com flags `OFF`.
2. Aplicar migration em produ\u00e7\u00e3o.
3. Validar health/audits.
4. Ativar `financeReceiptsV1` para canary por organiza\u00e7\u00e3o.
5. Ativar `financeReceiptAiV1` apenas ap\u00f3s validar upload privado e linkage.
