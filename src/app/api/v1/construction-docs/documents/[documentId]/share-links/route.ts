import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import {
  createShareLinkSchema,
  deleteShareLinkSchema,
} from '@/shared/schemas/construction-docs'
import { ensureDocumentOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'
import {
  generateShareToken,
  hashSharePassword,
  hashShareToken,
} from '@/server/services/construction-docs/share-service'

function getBaseUrl(request: Request) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = createShareLinkSchema.safeParse(await innerRequest.json().catch(() => null))
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

    const rawToken = generateShareToken()
    const tokenHash = hashShareToken(rawToken)
    const expiresAt = new Date(Date.now() + parsed.data.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
    const passwordHash = parsed.data.password ? hashSharePassword(parsed.data.password) : null

    const { data, error } = await supabase
      .from('construction_docs_share_links')
      .insert({
        org_id: orgId,
        document_id: documentId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        password_hash: passwordHash,
        created_by: user.id,
      })
      .select('id, expires_at, revoked_at, created_at')
      .single()

    if (error || !data) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.DB_ERROR,
          message: error?.message || 'Falha ao gerar link de compartilhamento',
        },
        500
      )
    }

    const shareUrl = `${getBaseUrl(innerRequest)}/portal/construction-docs/${rawToken}`

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'share_link_created',
      projectId: document.project_id,
      documentId,
      payload: {
        share_link_id: data.id,
        expires_at: data.expires_at,
        password_protected: Boolean(passwordHash),
      },
    }).catch(() => undefined)

    return ok(
      innerRequest,
      {
        id: data.id,
        share_url: shareUrl,
        expires_at: data.expires_at,
        password_protected: Boolean(passwordHash),
      },
      getConstructionDocsFlagMeta(),
      201
    )
  })

  return handler(request)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = deleteShareLinkSchema.safeParse(await innerRequest.json().catch(() => null))
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

    const { data: updated, error } = await supabase
      .from('construction_docs_share_links')
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('document_id', documentId)
      .eq('id', parsed.data.share_link_id)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle()

    if (error) {
      return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
    }

    if (!updated) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Link não encontrado ou já revogado' },
        404
      )
    }

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'share_link_revoked',
      projectId: document.project_id,
      documentId,
      payload: {
        share_link_id: parsed.data.share_link_id,
      },
    }).catch(() => undefined)

    return ok(innerRequest, { success: true }, getConstructionDocsFlagMeta())
  })

  return handler(request)
}
