import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import type { ReceiptReviewPayload } from '@/shared/types/transacao-receipts'

export class FinanceReceiptAiError extends Error {
  readonly reason: 'not_configured' | 'provider_failure' | 'invalid_output'

  constructor(message: string, reason: 'not_configured' | 'provider_failure' | 'invalid_output') {
    super(message)
    this.name = 'FinanceReceiptAiError'
    this.reason = reason
  }
}

const genAI = process.env.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
  : null

const receiptAiSchema = z.object({
  raw_text: z.string().nullable().default(null),
  fornecedor: z.object({
    value: z.string().nullable().default(null),
    confidence: z.number().min(0).max(1).nullable().default(null),
  }),
  descricao: z.object({
    value: z.string().nullable().default(null),
    confidence: z.number().min(0).max(1).nullable().default(null),
  }),
  valor_total: z.object({
    value: z.number().nonnegative().nullable().default(null),
    confidence: z.number().min(0).max(1).nullable().default(null),
  }),
  data_emissao: z.object({
    value: z.string().nullable().default(null),
    confidence: z.number().min(0).max(1).nullable().default(null),
  }),
  documento_fiscal: z.object({
    value: z.string().nullable().default(null),
    confidence: z.number().min(0).max(1).nullable().default(null),
  }),
  categoria: z.object({
    value: z.string().nullable().default(null),
    confidence: z.number().min(0).max(1).nullable().default(null),
  }),
  forma_pagamento: z.object({
    value: z.string().nullable().default(null),
    confidence: z.number().min(0).max(1).nullable().default(null),
  }),
})

function parseJson<T>(raw: string, schema: z.ZodSchema<T>): T | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0])
    const result = schema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

function toBase64(buffer: Buffer): string {
  return buffer.toString('base64')
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const match = trimmed.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/)
  if (!match) return trimmed || null
  return `${match[3]}-${match[2]}-${match[1]}`
}

function normalizePayload(input: z.infer<typeof receiptAiSchema>): ReceiptReviewPayload {
  return {
    provider: 'gemini',
    status: 'ready_for_review',
    raw_text: input.raw_text,
    fornecedor: input.fornecedor,
    descricao: input.descricao,
    valor_total: input.valor_total,
    data_emissao: {
      ...input.data_emissao,
      value: normalizeDate(input.data_emissao.value),
    },
    documento_fiscal: input.documento_fiscal,
    categoria: input.categoria,
    forma_pagamento: input.forma_pagamento,
  }
}

export function buildManualReceiptReviewPayload(input?: {
  rawText?: string | null
  errorReason?: string | null
  errorMessage?: string | null
}): ReceiptReviewPayload {
  return {
    provider: 'manual',
    status: input?.errorReason || input?.errorMessage ? 'failed' : 'manual_only',
    raw_text: input?.rawText || null,
    fornecedor: { value: null, confidence: null },
    descricao: { value: null, confidence: null },
    valor_total: { value: null, confidence: null },
    data_emissao: { value: null, confidence: null },
    documento_fiscal: { value: null, confidence: null },
    categoria: { value: null, confidence: null },
    forma_pagamento: { value: null, confidence: null },
    error_reason: input?.errorReason || null,
    error_message: input?.errorMessage || null,
  }
}

export async function extractReceiptReviewPayload(input: {
  fileName: string
  mimeType: string
  content: Buffer
}): Promise<ReceiptReviewPayload> {
  if (!genAI) {
    throw new FinanceReceiptAiError(
      'Integração de IA não configurada para leitura de recibos.',
      'not_configured'
    )
  }

  const model = genAI.getGenerativeModel({
    model: process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.5-flash',
  })
  const prompt = `
Você é um assistente contábil brasileiro. Analise o arquivo recebido e extraia dados úteis para cadastro de despesa.

Retorne APENAS JSON neste formato:
{
  "raw_text": "texto principal lido",
  "fornecedor": { "value": "nome", "confidence": 0.95 },
  "descricao": { "value": "descrição curta", "confidence": 0.91 },
  "valor_total": { "value": 123.45, "confidence": 0.92 },
  "data_emissao": { "value": "2026-03-05", "confidence": 0.88 },
  "documento_fiscal": { "value": "CNPJ/CPF/cupom", "confidence": 0.7 },
  "categoria": { "value": "categoria sugerida", "confidence": 0.73 },
  "forma_pagamento": { "value": "PIX/Boleto/Cartão/Dinheiro/Transferência", "confidence": 0.66 }
}

Regras:
- Use null quando não souber.
- confidence deve estar entre 0 e 1.
- data_emissao deve ser YYYY-MM-DD quando possível.
- valor_total deve ser número decimal em reais.
- descrição deve ser curta e objetiva.
- não inclua markdown nem texto extra.
Arquivo: ${input.fileName}
`.trim()

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: input.mimeType,
          data: toBase64(input.content),
        },
      },
    ])
    const text = result.response.text()
    const parsed = parseJson(text, receiptAiSchema)
    if (!parsed) {
      throw new FinanceReceiptAiError(
        'A IA retornou um formato inválido para o recibo.',
        'invalid_output'
      )
    }
    return normalizePayload(parsed)
  } catch (error) {
    if (error instanceof FinanceReceiptAiError) throw error
    throw new FinanceReceiptAiError(
      'Falha temporária no provedor de IA para leitura do recibo.',
      'provider_failure'
    )
  }
}

export function isFinanceReceiptAiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GEMINI_API_KEY)
}
