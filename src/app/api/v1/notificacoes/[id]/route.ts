import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }

  const body = await request.json().catch(() => ({}))
  const lida = body?.lida
  if (typeof lida !== 'boolean') {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Campo lida deve ser booleano' },
      400
    )
  }

  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('notificacoes')
    .update({ lida })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (dbError) {
    log('error', 'notificacoes.patch.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/notificacoes/[id]',
      notificacaoId: id,
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      400
    )
  }

  return ok(request, data)
}
