import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import type { InspectionReportPayload, SchedulePayload } from '@/shared/types/construction-docs'

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

function fallbackInspection(prompt: string): InspectionReportPayload {
  return {
    summary: `Relatório gerado em modo fallback para: ${prompt.slice(0, 120) || 'vistoria de obra'}`,
    findings: ['Necessário revisar pendências estruturais com check visual no local.'],
    recommendations: ['Registrar fotos por ambiente e definir plano de correção com responsável e prazo.'],
    generatedAt: new Date().toISOString(),
  }
}

function fallbackSchedule(prompt: string): SchedulePayload {
  const now = new Date()
  const start = now.toISOString().slice(0, 10)
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return {
    summary: `Cronograma gerado em modo fallback para: ${prompt.slice(0, 120) || 'obra'}`,
    tasks: [
      {
        id: 'task-1',
        title: 'Planejamento inicial',
        startsAt: start,
        endsAt: end,
        dependsOn: [],
      },
    ],
    generatedAt: new Date().toISOString(),
  }
}

const genAI = process.env.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
  : null

async function runPrompt(prompt: string): Promise<string | null> {
  if (!genAI) return null
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  try {
    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch {
    return null
  }
}

export async function generateInspectionReport(prompt: string): Promise<InspectionReportPayload> {
  const raw = await runPrompt(
    `${prompt}\nRetorne APENAS JSON com summary, findings(string[]), recommendations(string[]).`
  )
  const parsed = raw ? parseJson(raw, inspectionSchema) : null
  if (!parsed) return fallbackInspection(prompt)
  return {
    ...parsed,
    generatedAt: new Date().toISOString(),
  }
}

export async function generateSchedule(prompt: string): Promise<SchedulePayload> {
  const raw = await runPrompt(
    `${prompt}\nRetorne APENAS JSON com summary e tasks[{id,title,startsAt,endsAt,dependsOn:string[]}].`
  )
  const parsed = raw ? parseJson(raw, scheduleSchema) : null
  if (!parsed) return fallbackSchedule(prompt)
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

