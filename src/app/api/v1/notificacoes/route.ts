import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'

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
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
  const unreadOnly = searchParams.get('unread') === 'true'

  let query = supabase
    .from('notificacoes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (unreadOnly) query = query.eq('lida', false)

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

  return ok(request, data ?? [], {
    unreadCount: (data || []).filter((item) => !item.lida).length,
  })
}
