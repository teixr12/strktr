import { z } from 'zod'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import {
  createTemplateSchema,
  updateTemplateSchema,
} from '@/shared/schemas/construction-docs'
import { ensureTemplateOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'

const updateTemplatePayloadSchema = z.object({
  id: z.string().uuid(),
  patch: updateTemplateSchema,
})

export const GET = withConstructionDocsAuth('can_manage_projects', async (request, { supabase, orgId }) => {
  const { searchParams } = new URL(request.url)
  const docType = searchParams.get('doc_type')?.trim() || null

  let query = supabase
    .from('construction_docs_templates')
    .select('id, org_id, doc_type, name, dsl, version, is_active, created_by, created_at, updated_at')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })

  if (docType) {
    query = query.eq('doc_type', docType)
  }

  const { data, error } = await query
  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, data || [], getConstructionDocsFlagMeta())
})

export const POST = withConstructionDocsAuth('can_manage_projects', async (request, { supabase, orgId, user }) => {
  const parsed = createTemplateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message || 'Payload inválido',
      },
      400
    )
  }

  const payload = parsed.data

  if (payload.is_active) {
    await supabase
      .from('construction_docs_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('doc_type', payload.doc_type)
  }

  const { data, error } = await supabase
    .from('construction_docs_templates')
    .insert({
      org_id: orgId,
      doc_type: payload.doc_type,
      name: payload.name,
      dsl: payload.dsl,
      version: 1,
      is_active: payload.is_active,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .select('id, org_id, doc_type, name, dsl, version, is_active, created_by, created_at, updated_at')
    .single()

  if (error || !data) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Erro ao criar template' },
      500
    )
  }

  await appendConstructionAudit({
    supabase,
    orgId,
    actorUserId: user.id,
    eventType: 'template_created',
    payload: {
      template_id: data.id,
      doc_type: data.doc_type,
      is_active: data.is_active,
    },
  }).catch(() => undefined)

  return ok(request, data, getConstructionDocsFlagMeta(), 201)
})

export const PATCH = withConstructionDocsAuth('can_manage_projects', async (request, { supabase, orgId, user }) => {
  const parsed = updateTemplatePayloadSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message || 'Payload inválido',
      },
      400
    )
  }

  const existing = await ensureTemplateOwnership(supabase, orgId, parsed.data.id)
  if (!existing) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Template não encontrado' }, 404)
  }

  if (parsed.data.patch.is_active) {
    await supabase
      .from('construction_docs_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('doc_type', existing.doc_type)
      .neq('id', existing.id)
  }

  const nextVersion = parsed.data.patch.dsl ? Number(existing.version || 1) + 1 : existing.version
  const { data, error } = await supabase
    .from('construction_docs_templates')
    .update({
      ...parsed.data.patch,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .eq('id', existing.id)
    .select('id, org_id, doc_type, name, dsl, version, is_active, created_by, created_at, updated_at')
    .single()

  if (error || !data) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Erro ao atualizar template' },
      500
    )
  }

  await appendConstructionAudit({
    supabase,
    orgId,
    actorUserId: user.id,
    eventType: 'template_updated',
    payload: {
      template_id: data.id,
      version: data.version,
      is_active: data.is_active,
    },
  }).catch(() => undefined)

  return ok(request, data, getConstructionDocsFlagMeta())
})
