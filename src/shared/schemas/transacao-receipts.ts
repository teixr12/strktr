import { z } from 'zod'

export const receiptSuggestionStringSchema = z.object({
  value: z.string().trim().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
})

export const receiptSuggestionNumberSchema = z.object({
  value: z.number().nonnegative().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
})

export const receiptReviewPayloadSchema = z.object({
  provider: z.enum(['gemini', 'manual']),
  status: z.enum(['ready_for_review', 'manual_only', 'failed']),
  raw_text: z.string().nullable(),
  fornecedor: receiptSuggestionStringSchema,
  descricao: receiptSuggestionStringSchema,
  valor_total: receiptSuggestionNumberSchema,
  data_emissao: receiptSuggestionStringSchema,
  documento_fiscal: receiptSuggestionStringSchema,
  categoria: receiptSuggestionStringSchema,
  forma_pagamento: receiptSuggestionStringSchema,
  error_reason: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
})

export const linkReceiptIntakeSchema = z.object({
  receipt_intake_id: z.string().uuid('Recibo inválido'),
})

export type LinkReceiptIntakeDTO = z.infer<typeof linkReceiptIntakeSchema>
