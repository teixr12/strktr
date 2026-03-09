import { GoogleGenerativeAI } from '@google/generative-ai'
import { inflateSync } from 'node:zlib'
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

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ')
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\([\\()])/g, '$1')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8)))
}

function extractPdfTextLiterals(streamText: string): string[] {
  const values: string[] = []

  for (let index = 0; index < streamText.length; index += 1) {
    if (streamText[index] !== '(') continue

    let depth = 1
    let cursor = index + 1
    let literal = ''

    while (cursor < streamText.length && depth > 0) {
      const char = streamText[cursor]

      if (char === '\\') {
        const next = streamText[cursor + 1]
        if (next) {
          literal += `\\${next}`
          cursor += 2
          continue
        }
      }

      if (char === '(') {
        depth += 1
        literal += char
        cursor += 1
        continue
      }

      if (char === ')') {
        depth -= 1
        if (depth === 0) break
        literal += char
        cursor += 1
        continue
      }

      literal += char
      cursor += 1
    }

    if (depth === 0) {
      const decoded = decodePdfLiteral(literal).trim()
      if (decoded) values.push(decoded)
      index = cursor
    }
  }

  return values
}

function extractPdfText(buffer: Buffer): string | null {
  const raw = buffer.toString('latin1')
  const streamPattern = /<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g
  const fragments: string[] = []

  for (const match of raw.matchAll(streamPattern)) {
    const dictionary = match[1] || ''
    const body = match[2] || ''
    let streamText = body

    if (/\/Filter\s*(?:\[[^\]]*\/FlateDecode[^\]]*\]|\/FlateDecode)/.test(dictionary)) {
      try {
        streamText = inflateSync(Buffer.from(body, 'latin1')).toString('latin1')
      } catch {
        continue
      }
    }

    fragments.push(...extractPdfTextLiterals(streamText))
  }

  if (fragments.length === 0) return null

  const text = normalizeWhitespace(fragments.join('\n'))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')

  return text || null
}

function parseBrazilianCurrency(value: string): number | null {
  const cleaned = value.replace(/[^\d,.-]/g, '').trim()
  if (!cleaned) return null

  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function buildHeuristicPayload(rawText: string): Partial<ReceiptReviewPayload> {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const pickLine = (pattern: RegExp) => lines.find((line) => pattern.test(line)) || null

  const fornecedorLine =
    lines.find(
      (line) =>
        !/^(cnpj|cpf|recibo|nota|comprovante|valor|data|forma|categoria)\b/i.test(line)
    ) || null

  const descricaoLine =
    pickLine(/\b(recibo|nota|comprovante|materiais|servi[cç]os?)\b/i) ||
    lines.find((line) => line !== fornecedorLine) ||
    null

  const cnpjMatch = rawText.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)
  const cpfMatch = rawText.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/)
  const valorMatch =
    rawText.match(/valor(?: total)?\s*(?:r\$\s*)?([0-9.,]+)/i) ||
    rawText.match(/r\$\s*([0-9.,]+)/i)
  const dataMatch =
    rawText.match(/data(?: de)? emiss[aã]o\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{4})/i) ||
    rawText.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}[\/.-]\d{2}[\/.-]\d{4})\b/)
  const formaMatch = rawText.match(
    /\b(PIX|Boleto|Cart[aã]o|Dinheiro|Transfer[êe]ncia|D[eé]bito|Cr[eé]dito)\b/i
  )
  const categoriaMatch =
    rawText.match(/categoria(?: sugerida)?\s*[:\-]?\s*([^\n]+)/i) ||
    rawText.match(/\b(materiais|servi[cç]os?|combust[ií]vel|alimenta[cç][aã]o)\b/i)

  return {
    raw_text: rawText,
    fornecedor: {
      value: fornecedorLine,
      confidence: fornecedorLine ? 0.9 : null,
    },
    descricao: {
      value: descricaoLine,
      confidence: descricaoLine ? 0.82 : null,
    },
    valor_total: {
      value: valorMatch ? parseBrazilianCurrency(valorMatch[1]) : null,
      confidence: valorMatch ? 0.94 : null,
    },
    data_emissao: {
      value: dataMatch ? normalizeDate(dataMatch[1]) : null,
      confidence: dataMatch ? 0.91 : null,
    },
    documento_fiscal: {
      value: cnpjMatch?.[0] || cpfMatch?.[0] || null,
      confidence: cnpjMatch || cpfMatch ? 0.96 : null,
    },
    categoria: {
      value: categoriaMatch?.[1]?.trim() || null,
      confidence: categoriaMatch ? 0.88 : null,
    },
    forma_pagamento: {
      value: formaMatch?.[1] || null,
      confidence: formaMatch ? 0.9 : null,
    },
  }
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

function mergeSuggestedField<T extends string | number>(
  primary: { value: T | null; confidence: number | null },
  fallback?: { value: T | null; confidence: number | null }
): { value: T | null; confidence: number | null } {
  if (primary.value !== null && primary.value !== '') return primary
  return fallback ? { value: fallback.value, confidence: fallback.confidence } : primary
}

function mergeHeuristicPayload(
  payload: ReceiptReviewPayload,
  heuristics: Partial<ReceiptReviewPayload> | null
): ReceiptReviewPayload {
  if (!heuristics) return payload

  return {
    ...payload,
    raw_text: payload.raw_text || heuristics.raw_text || null,
    fornecedor: mergeSuggestedField(payload.fornecedor, heuristics.fornecedor),
    descricao: mergeSuggestedField(payload.descricao, heuristics.descricao),
    valor_total: mergeSuggestedField(payload.valor_total, heuristics.valor_total),
    data_emissao: mergeSuggestedField(payload.data_emissao, heuristics.data_emissao),
    documento_fiscal: mergeSuggestedField(payload.documento_fiscal, heuristics.documento_fiscal),
    categoria: mergeSuggestedField(payload.categoria, heuristics.categoria),
    forma_pagamento: mergeSuggestedField(payload.forma_pagamento, heuristics.forma_pagamento),
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
  const extractedPdfText =
    input.mimeType === 'application/pdf' ? extractPdfText(input.content) : null
  const heuristics = extractedPdfText ? buildHeuristicPayload(extractedPdfText) : null

  const prompt = `
Você é um assistente contábil brasileiro. Analise o arquivo recebido e extraia dados úteis para cadastro de despesa.

Quando houver texto extraído localmente do PDF, use esse texto como fonte primária.
Se o texto extraído parecer incompleto, complemente com o arquivo original quando ele for enviado.

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
    const parts =
      extractedPdfText && extractedPdfText.length >= 20
        ? [
            prompt,
            `TEXTO_EXTRAIDO_LOCALMENTE:\n${extractedPdfText.slice(0, 8000)}`,
          ]
        : [
            prompt,
            {
              inlineData: {
                mimeType: input.mimeType,
                data: toBase64(input.content),
              },
            },
          ]

    const result = await model.generateContent(parts)
    const text = result.response.text()
    const parsed = parseJson(text, receiptAiSchema)
    if (!parsed) {
      throw new FinanceReceiptAiError(
        'A IA retornou um formato inválido para o recibo.',
        'invalid_output'
      )
    }
    return mergeHeuristicPayload(normalizePayload(parsed), heuristics)
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
