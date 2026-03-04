import type { SupabaseClient } from '@supabase/supabase-js'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { sendNotificationEmail } from '@/lib/email/resend'
import { sendDocumentEmailSchema } from '@/shared/schemas/construction-docs'
import { ensureDocumentOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'
import { generateShareToken, hashShareToken } from '@/server/services/construction-docs/share-service'

function getBaseUrl(request: Request) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

async function ensureShareUrl(input: {
  supabase: SupabaseClient
  orgId: string
  userId: string
  documentId: string
  explicitShareUrl?: string
  baseUrl: string
}) {
  const fallbackUrl = `${input.baseUrl}/construction-docs/documents/${input.documentId}`
  if (input.explicitShareUrl) {
    return {
      url: input.explicitShareUrl,
      source: 'explicit' as const,
    }
  }

  const rawToken = generateShareToken()
  const tokenHash = hashShareToken(rawToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await input.supabase.from('construction_docs_share_links').insert({
    org_id: input.orgId,
    document_id: input.documentId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    password_hash: null,
    created_by: input.userId,
  })

  if (error) {
    return {
      url: fallbackUrl,
      source: 'internal_fallback' as const,
    }
  }

  return {
    url: `${input.baseUrl}/portal/construction-docs/${rawToken}`,
    source: 'auto_public_link' as const,
  }
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

    const share = await ensureShareUrl({
      supabase,
      orgId,
      userId: user.id,
      documentId,
      explicitShareUrl: parsed.data.share_url,
      baseUrl: getBaseUrl(innerRequest),
    })
    const link = share.url
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
        share_url_source: share.source,
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
