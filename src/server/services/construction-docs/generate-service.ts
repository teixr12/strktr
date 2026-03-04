import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConstructionDocType } from '@/shared/types/construction-docs'
import type { ConstructionDocsTemplateDSL } from '@/shared/types/construction-docs'
import {
  generateInspectionReport,
  generateSchedule,
  generateSop,
} from '@/server/services/construction-docs/ai/adapter'
import { renderTemplateHtml } from '@/server/services/construction-docs/template-renderer'

interface BaseGenerateInput {
  supabase: SupabaseClient
  orgId: string
  userId: string
  projectId: string
  obraId: string | null
  prompt: string
  templateId?: string
  input?: Record<string, unknown>
}

async function resolveTemplateDsl(input: {
  supabase: SupabaseClient
  orgId: string
  docType: ConstructionDocType
  templateId?: string
}) {
  if (input.templateId) {
    const { data: selected } = await input.supabase
      .from('construction_docs_templates')
      .select('dsl')
      .eq('org_id', input.orgId)
      .eq('id', input.templateId)
      .maybeSingle()
    if (selected?.dsl) return selected.dsl as Record<string, unknown>
  }

  const { data: active } = await input.supabase
    .from('construction_docs_templates')
    .select('dsl')
    .eq('org_id', input.orgId)
    .eq('doc_type', input.docType)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (active?.dsl) return active.dsl as Record<string, unknown>
  return null
}

async function insertDocument(input: {
  supabase: SupabaseClient
  orgId: string
  userId: string
  projectId: string
  obraId: string | null
  type: ConstructionDocType
  payload: Record<string, unknown>
  renderedHtml: string | null
}) {
  const { data, error } = await input.supabase
    .from('construction_docs_documents')
    .insert({
      org_id: input.orgId,
      project_id: input.projectId,
      obra_id: input.obraId,
      type: input.type,
      status: 'DRAFT',
      payload: input.payload,
      rendered_html: input.renderedHtml,
      created_by: input.userId,
      updated_by: input.userId,
      updated_at: new Date().toISOString(),
    })
    .select('id, org_id, project_id, obra_id, type, status, payload, rendered_html, pdf_key, created_by, updated_by, created_at, updated_at')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao criar documento')
  }

  return data
}

export async function generateInspectionDocument(input: BaseGenerateInput) {
  const inspection = await generateInspectionReport(input.prompt)
  const templateDsl = await resolveTemplateDsl({
    supabase: input.supabase,
    orgId: input.orgId,
    docType: 'INSPECTION',
    templateId: input.templateId,
  })

  const payload = {
    ...inspection,
    ...(input.input || {}),
  }

  const renderedHtml =
    templateDsl && typeof templateDsl === 'object'
      ? renderTemplateHtml(templateDsl as unknown as ConstructionDocsTemplateDSL, payload)
      : null

  return insertDocument({
    supabase: input.supabase,
    orgId: input.orgId,
    userId: input.userId,
    projectId: input.projectId,
    obraId: input.obraId,
    type: 'INSPECTION',
    payload,
    renderedHtml,
  })
}

export async function generateScheduleDocument(input: BaseGenerateInput) {
  const schedule = await generateSchedule(input.prompt)
  const templateDsl = await resolveTemplateDsl({
    supabase: input.supabase,
    orgId: input.orgId,
    docType: 'SCHEDULE',
    templateId: input.templateId,
  })

  const payload = {
    ...schedule,
    ...(input.input || {}),
  }

  const renderedHtml =
    templateDsl && typeof templateDsl === 'object'
      ? renderTemplateHtml(templateDsl as unknown as ConstructionDocsTemplateDSL, payload)
      : null

  return insertDocument({
    supabase: input.supabase,
    orgId: input.orgId,
    userId: input.userId,
    projectId: input.projectId,
    obraId: input.obraId,
    type: 'SCHEDULE',
    payload,
    renderedHtml,
  })
}

export async function generateSopDocument(input: BaseGenerateInput) {
  const sop = await generateSop(input.prompt)
  const templateDsl = await resolveTemplateDsl({
    supabase: input.supabase,
    orgId: input.orgId,
    docType: 'SOP',
    templateId: input.templateId,
  })

  const payload = {
    ...sop,
    ...(input.input || {}),
  }

  const renderedHtml =
    templateDsl && typeof templateDsl === 'object'
      ? renderTemplateHtml(templateDsl as unknown as ConstructionDocsTemplateDSL, payload)
      : null

  return insertDocument({
    supabase: input.supabase,
    orgId: input.orgId,
    userId: input.userId,
    projectId: input.projectId,
    obraId: input.obraId,
    type: 'SOP',
    payload,
    renderedHtml,
  })
}
