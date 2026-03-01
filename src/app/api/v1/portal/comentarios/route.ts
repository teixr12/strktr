import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { emitProductEvent } from '@/lib/telemetry'
import { getValidPortalSession } from '@/server/services/portal/session-service'
import { createPortalCommentSchema } from '@/shared/schemas/cronograma-portal'

export async function POST(request: Request) {
  const service = createServiceRoleClient()
  if (!service) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: 'Service role não configurado' }, 500)
  }

  const parsed = createPortalCommentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }

  const { token, mensagem, aprovacao_id } = parsed.data
  const { session, error } = await getValidPortalSession(service, token)
  if (error || !session) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: 'Sessão do portal inválida ou expirada' }, 401)
  }

  if (aprovacao_id) {
    const { data: approval } = await service
      .from('aprovacoes_cliente')
      .select('id')
      .eq('id', aprovacao_id)
      .eq('org_id', session.org_id)
      .eq('obra_id', session.obra_id)
      .maybeSingle()

    if (!approval) {
      return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Aprovação não encontrada para comentário' }, 404)
    }
  }

  const { data: created, error: createError } = await service
    .from('portal_comentarios')
    .insert({
      org_id: session.org_id,
      obra_id: session.obra_id,
      portal_cliente_id: session.portal_cliente_id,
      user_id: null,
      aprovacao_id: aprovacao_id || null,
      origem: 'cliente',
      mensagem,
    })
    .select('id, origem, mensagem, created_at, aprovacao_id')
    .single()

  if (createError || !created) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: createError?.message || 'Erro ao registrar comentário' },
      500
    )
  }

  await emitProductEvent({
    supabase: service,
    orgId: session.org_id,
    userId: session.portal_cliente_id,
    eventType: 'portal_comment_created',
    entityType: 'portal_comment',
    entityId: created.id,
    payload: {
      obraId: session.obra_id,
      aprovacaoId: created.aprovacao_id,
      source: 'portal',
    },
  }).catch(() => undefined)

  return ok(request, created, { flag: 'NEXT_PUBLIC_FF_CLIENT_PORTAL' }, 201)
}
