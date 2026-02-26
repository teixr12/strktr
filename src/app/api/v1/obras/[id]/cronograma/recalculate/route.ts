import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { recalculateSchedule } from '@/server/services/cronograma/schedule-service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const { id: obraId } = await params
  const [cronogramaRes, itensRes, depsRes] = await Promise.all([
    supabase
      .from('cronograma_obras')
      .select('id, calendario')
      .eq('obra_id', obraId)
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('cronograma_itens')
      .select('id, status, duracao_dias, data_inicio_planejada, data_fim_planejada')
      .eq('obra_id', obraId)
      .eq('org_id', orgId)
      .order('ordem', { ascending: true }),
    supabase
      .from('cronograma_dependencias')
      .select('predecessor_item_id, successor_item_id, lag_dias')
      .eq('org_id', orgId),
  ])

  if (itensRes.error || depsRes.error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: 'Erro ao carregar cronograma' }, 500)
  }

  const schedule = recalculateSchedule(
    itensRes.data || [],
    depsRes.data || [],
    cronogramaRes.data?.calendario as { dias_uteis?: number[]; feriados?: string[] } | undefined
  )
  const updates = schedule.updates

  for (const entry of updates) {
    const { error: updateError } = await supabase
      .from('cronograma_itens')
      .update({
        data_inicio_planejada: entry.data_inicio_planejada,
        data_fim_planejada: entry.data_fim_planejada,
        atraso_dias: entry.atraso_dias,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id)
      .eq('org_id', orgId)

    if (updateError) {
      log('error', 'cronograma.recalculate.item_update_failed', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/obras/[id]/cronograma/recalculate',
        obraId,
        itemId: entry.id,
        error: updateError.message,
      })
    }
  }

  if (cronogramaRes.data?.id) {
    await supabase
      .from('cronograma_obras')
      .update({
        data_fim_planejada: schedule.summary.projectedEndDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cronogramaRes.data.id)
      .eq('org_id', orgId)
  }

  return ok(request, {
    summary: schedule.summary,
    updatedItems: updates.length,
  })
}
