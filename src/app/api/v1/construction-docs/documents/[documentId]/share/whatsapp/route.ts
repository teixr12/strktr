import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { sendTextMessage } from '@/lib/whatsapp'
import { shareDocumentWhatsAppSchema } from '@/shared/schemas/construction-docs'
import { ensureDocumentOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, '')
}

function getBaseUrl(request: Request) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = shareDocumentWhatsAppSchema.safeParse(await innerRequest.json().catch(() => null))
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

    const phone = normalizePhone(parsed.data.to)
    if (phone.length < 8) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Telefone inválido' },
        400
      )
    }

    const shareUrl = parsed.data.share_url || `${getBaseUrl(innerRequest)}/construction-docs/documents/${documentId}`
    const message =
      parsed.data.message?.trim() ||
      `STRKTR Construction Docs: documento ${document.type} (${document.status}). ${shareUrl}`

    const external = await sendTextMessage(phone, message)
    const fallbackUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'document_shared_whatsapp',
      projectId: document.project_id,
      documentId,
      payload: {
        to: phone,
        provider_success: Boolean(external),
      },
    }).catch(() => undefined)

    if (!external) {
      return ok(
        innerRequest,
        {
          success: false,
          fallbackUrl,
          message: 'WhatsApp API indisponível. Use o link de fallback.',
        },
        {
          ...getConstructionDocsFlagMeta(),
          fallback: true,
        },
        202
      )
    }

    return ok(
      innerRequest,
      {
        success: true,
        provider: 'whatsapp_business',
      },
      getConstructionDocsFlagMeta(),
      201
    )
  })

  return handler(request)
}
