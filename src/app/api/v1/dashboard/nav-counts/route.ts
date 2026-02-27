import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'

type CountField = 'obras_ativas' | 'leads_hot' | 'compras_pendentes_aprovacao'

async function countOrNull(
  field: CountField,
  queryFactory: () => PromiseLike<{
    count: number | null
    error: { message: string } | null
  }>
): Promise<number | null> {
  const { count, error } = await queryFactory()
  if (error) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'dashboard.nav_counts.partial_failure',
        field,
        error: error.message,
      })
    )
    return null
  }
  return count ?? 0
}

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }
  if (!orgId) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' },
      403
    )
  }

  try {
    const [obrasAtivas, leadsHot, comprasPendentesAprovacao] = await Promise.all([
      countOrNull('obras_ativas', () =>
        supabase
          .from('obras')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'Em Andamento')
      ),
      countOrNull('leads_hot', () =>
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('temperatura', 'Hot')
      ),
      countOrNull('compras_pendentes_aprovacao', () =>
        supabase
          .from('compras')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .eq('status', 'Pendente Aprovação Cliente')
      ),
    ])

    return ok(request, {
      obras_ativas: obrasAtivas,
      leads_hot: leadsHot,
      compras_pendentes_aprovacao: comprasPendentesAprovacao,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao calcular contadores'
    log('error', 'dashboard.nav_counts.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/dashboard/nav-counts',
      error: message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message },
      500
    )
  }
}
