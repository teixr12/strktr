import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { emitProductEvent } from '@/lib/telemetry'
import { generateDocumentSchema } from '@/shared/schemas/construction-docs'
import { ensureProjectOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'
import { generateScheduleDocument } from '@/server/services/construction-docs/generate-service'

export const POST = withConstructionDocsAuth('can_manage_projects', async (request, { supabase, orgId, user }) => {
  const parsed = generateDocumentSchema.safeParse(await request.json().catch(() => null))
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
  const project = await ensureProjectOwnership(supabase, orgId, payload.project_id)
  if (!project) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Projeto não encontrado' }, 404)
  }

  try {
    const document = await generateScheduleDocument({
      supabase,
      orgId,
      userId: user.id,
      projectId: payload.project_id,
      obraId: payload.obra_id || project.obra_id || null,
      prompt:
        payload.prompt?.trim() ||
        `Gerar cronograma de obra para projeto ${payload.project_id} com tarefas e dependências.`,
      templateId: payload.template_id,
      input: payload.input,
    })

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'document_generated_schedule',
      projectId: payload.project_id,
      documentId: document.id,
      payload: {
        type: 'SCHEDULE',
      },
    }).catch(() => undefined)

    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'core_create',
      entityType: 'construction_docs_document',
      entityId: document.id,
      payload: {
        source: 'web',
        outcome: 'success',
        type: 'SCHEDULE',
      },
      mirrorExternal: true,
    }).catch(() => undefined)

    return ok(request, document, getConstructionDocsFlagMeta(), 201)
  } catch (error) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.DB_ERROR,
        message: error instanceof Error ? error.message : 'Falha ao gerar documento de cronograma',
      },
      500
    )
  }
})
