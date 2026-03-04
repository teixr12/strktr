import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { sendNotificationEmail } from '@/lib/email/resend'
import { sendDocumentEmailSchema } from '@/shared/schemas/construction-docs'
import { ensureDocumentOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'

function getBaseUrl(request: Request) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = sendDocumentEmailSchema.safeParse(await innerRequest.json().catch(() => null))
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
    const document = await ensureDocumentOwnership(supabase, orgId, documentId)
    if (!document) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Documento não encontrado' },
        404
      )
    }

    const link = parsed.data.share_url || `${getBaseUrl(innerRequest)}/construction-docs/documents/${documentId}`
    const title = `Construction Docs - ${document.type}`
    const description =
      parsed.data.message?.trim() ||
      `Status atual: ${document.status}. Acesse o documento em: ${link}`

    const result = await sendNotificationEmail(
      parsed.data.to,
      parsed.data.subject?.trim() || title,
      title,
      description,
      link
    )

    if (!result) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.DB_ERROR,
          message: 'Falha no envio por e-mail. Verifique integração Resend.',
        },
        503
      )
    }

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'document_sent_email',
      projectId: document.project_id,
      documentId,
      payload: {
        to: parsed.data.to,
        provider_id: result.id,
      },
    }).catch(() => undefined)

    return ok(
      innerRequest,
      {
        success: true,
        id: result.id,
      },
      getConstructionDocsFlagMeta(),
      201
    )
  })

  return handler(request)
}
