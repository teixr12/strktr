import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'

const NOTIFICACAO_SELECT_FIELDS = [
  'id',
  'user_id',
  'tipo',
  'titulo',
  'descricao',
  'lida',
  'link',
  'created_at',
].join(', ')

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 200)
  const unreadOnly = searchParams.get('unread') === 'true'
  const tipo = searchParams.get('tipo')

  let query = supabase
    .from('notificacoes')
    .select(NOTIFICACAO_SELECT_FIELDS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (unreadOnly) query = query.eq('lida', false)
  if (tipo) query = query.eq('tipo', tipo)

  const { data, error: dbError } = await query
  if (dbError) {
    log('error', 'notificacoes.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/notificacoes',
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      500
    )
  }

  const notifications = (data ?? []) as unknown as Array<{ lida: boolean }>
  return ok(request, data ?? [], {
    unreadCount: notifications.filter((item) => !item.lida).length,
  })
}
