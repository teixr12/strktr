import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, requireConstructionDocsEnabled } from '@/lib/construction-docs/api'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { hashShareToken, verifySharePassword } from '@/server/services/construction-docs/share-service'
import type { ShareLinkAccessResult } from '@/shared/types/construction-docs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const gate = requireConstructionDocsEnabled(request)
  if (gate) return gate

  const { token } = await params
  const tokenHash = hashShareToken(token)

  const service = createServiceRoleClient()
  if (!service) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.DB_ERROR,
        message: 'Service role indisponível para leitura pública',
      },
      503
    )
  }

  const { data: shareLink, error: shareError } = await service
    .from('construction_docs_share_links')
    .select('id, org_id, document_id, expires_at, password_hash, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (shareError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: shareError.message }, 500)
  }

  if (!shareLink || shareLink.revoked_at) {
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: 'Link de compartilhamento inválido' },
      404
    )
  }

  if (new Date(shareLink.expires_at).getTime() <= Date.now()) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Link de compartilhamento expirado' },
      403
    )
  }

  const { searchParams } = new URL(request.url)
  const providedPassword =
    searchParams.get('password')?.trim() || request.headers.get('x-share-password')?.trim() || ''

  if (shareLink.password_hash && !verifySharePassword(providedPassword, shareLink.password_hash)) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'Senha inválida para este link de compartilhamento',
      },
      403
    )
  }

  const { data: document, error: docError } = await service
    .from('construction_docs_documents')
    .select('id, type, status, payload, rendered_html, updated_at')
    .eq('id', shareLink.document_id)
    .eq('org_id', shareLink.org_id)
    .maybeSingle()

  if (docError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: docError.message }, 500)
  }

  if (!document) {
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: 'Documento não encontrado' },
      404
    )
  }

  const payload: ShareLinkAccessResult = {
    document,
    expiresAt: shareLink.expires_at,
  }

  return ok(request, payload, getConstructionDocsFlagMeta())
}
