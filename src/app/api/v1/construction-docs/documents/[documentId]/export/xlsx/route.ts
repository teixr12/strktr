import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { ensureDocumentOwnership } from '@/server/repositories/construction-docs/repository'

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

    return ok(
      innerRequest,
      {
        available: false,
        message: 'Export XLSX ainda não habilitado neste ambiente. Use CSV no V1.',
        csv_endpoint: `/api/v1/construction-docs/documents/${documentId}/export/csv`,
      },
      {
        ...getConstructionDocsFlagMeta(),
        fallback: 'csv',
      },
      200
    )
  })

  return handler(request)
}
