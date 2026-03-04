import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { ensureDocumentOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'
import { toCsvRows } from '@/server/services/construction-docs/template-renderer'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const { documentId } = await params
    const document = await ensureDocumentOwnership(supabase, orgId, documentId)
    if (!document) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Documento não encontrado' },
        404
      )
    }

    const csv = toCsvRows((document.payload as Record<string, unknown>) || {})
    const fileName = `construction-doc-${document.id}.csv`

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'document_exported_csv',
      projectId: document.project_id,
      documentId,
      payload: {
        bytes: Buffer.byteLength(csv, 'utf8'),
      },
    }).catch(() => undefined)

    return ok(
      innerRequest,
      {
        fileName,
        mimeType: 'text/csv',
        csv,
      },
      getConstructionDocsFlagMeta()
    )
  })

  return handler(request)
}
