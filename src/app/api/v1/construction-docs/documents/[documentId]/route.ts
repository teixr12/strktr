import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { updateDocumentSchema } from '@/shared/schemas/construction-docs'
import { ensureDocumentOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId }) => {
    const { documentId } = await params
    const document = await ensureDocumentOwnership(supabase, orgId, documentId)
    if (!document) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Documento não encontrado' },
        404
      )
    }

    const { data: shareLinks, error: linksError } = await supabase
      .from('construction_docs_share_links')
      .select('id, expires_at, revoked_at, created_at')
      .eq('org_id', orgId)
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })

    if (linksError) {
      return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: linksError.message }, 500)
    }

    return ok(
      innerRequest,
      {
        ...document,
        share_links: shareLinks || [],
      },
      getConstructionDocsFlagMeta()
    )
  })

  return handler(request)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = updateDocumentSchema.safeParse(await innerRequest.json().catch(() => null))
    if (!parsed.success) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: parsed.error.issues[0]?.message || 'Payload inválido',
        },
        400
      )
    }

    const { documentId } = await params
    const existing = await ensureDocumentOwnership(supabase, orgId, documentId)
    if (!existing) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Documento não encontrado' },
        404
      )
    }

    const { data: updated, error } = await supabase
      .from('construction_docs_documents')
      .update({
        ...parsed.data,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('id', documentId)
      .select('id, org_id, project_id, obra_id, type, status, payload, rendered_html, pdf_key, created_by, updated_by, created_at, updated_at')
      .single()

    if (error || !updated) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.DB_ERROR,
          message: error?.message || 'Erro ao atualizar documento',
        },
        500
      )
    }

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'document_updated',
      projectId: updated.project_id,
      documentId: updated.id,
      payload: {
        status: updated.status,
      },
    }).catch(() => undefined)

    return ok(innerRequest, updated, getConstructionDocsFlagMeta())
  })

  return handler(request)
}
