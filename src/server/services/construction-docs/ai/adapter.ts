import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import type { InspectionReportPayload, SchedulePayload } from '@/shared/types/construction-docs'

type ConstructionDocsAiErrorReason = 'not_configured' | 'provider_failure' | 'invalid_output'

export class ConstructionDocsAiError extends Error {
  readonly reason: ConstructionDocsAiErrorReason

  constructor(message: string, reason: ConstructionDocsAiErrorReason) {
    super(message)
    this.name = 'ConstructionDocsAiError'
    this.reason = reason
  }
}

const inspectionSchema = z.object({
  summary: z.string().min(10),
  findings: z.array(z.string().min(3)).min(1),
  recommendations: z.array(z.string().min(3)).min(1),
})

const scheduleSchema = z.object({
  summary: z.string().min(10),
  tasks: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(3),
        startsAt: z.string().min(10),
        endsAt: z.string().min(10),
        dependsOn: z.array(z.string()).default([]),
      })
    )
    .min(1),
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

const genAI = process.env.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
  : null

async function runPrompt(prompt: string): Promise<string> {
  if (!genAI) {
    throw new ConstructionDocsAiError(
      'Integração de IA não configurada para geração de documentos.',
      'not_configured'
    )
  }
  const model = genAI.getGenerativeModel({
    model: process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.5-flash',
  })
  try {
    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch {
    throw new ConstructionDocsAiError(
      'Falha temporária no provedor de IA. Tente novamente em instantes.',
      'provider_failure'
    )
  }
}

export async function generateInspectionReport(prompt: string): Promise<InspectionReportPayload> {
  const raw = await runPrompt(
    `${prompt}\nRetorne APENAS JSON com summary, findings(string[]), recommendations(string[]).`
  )
  const parsed = parseJson(raw, inspectionSchema)
  if (!parsed) {
    throw new ConstructionDocsAiError(
      'A IA retornou um formato inválido para relatório de inspeção.',
      'invalid_output'
    )
  }
  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
  }
}

export async function generateSchedule(prompt: string): Promise<SchedulePayload> {
  const raw = await runPrompt(
    `${prompt}\nRetorne APENAS JSON com summary e tasks[{id,title,startsAt,endsAt,dependsOn:string[]}].`
  )
  const parsed = parseJson(raw, scheduleSchema)
  if (!parsed) {
    throw new ConstructionDocsAiError(
      'A IA retornou um formato inválido para cronograma.',
      'invalid_output'
    )
  }
  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
  }
}

export async function generateSop(prompt: string): Promise<InspectionReportPayload> {
  return generateInspectionReport(prompt)
}

export function isConstructionDocsAiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GEMINI_API_KEY)
}
