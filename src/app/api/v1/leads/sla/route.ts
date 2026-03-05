import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { emitProductEvent } from '@/lib/telemetry'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_leads')
  if (permissionError) return permissionError

  const { searchParams } = new URL(request.url)
  const slaHours = Math.max(
    1,
    Math.min(parseInt(searchParams.get('slaHours') || '48', 10), 24 * 30)
  )
  const now = Date.now()
  const cutoffIso = new Date(now - slaHours * 60 * 60 * 1000).toISOString()
  const activeStatuses = ['Novo', 'Qualificado', 'Proposta', 'Negociação'] as const
  const stalledFilter = `ultimo_contato.lt.${cutoffIso},and(ultimo_contato.is.null,updated_at.lt.${cutoffIso})`

  const [totalAtivosRes, stalledCountRes, stalledLeadsRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', activeStatuses),
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .in('status', activeStatuses)
      .or(stalledFilter),
    supabase
      .from('leads')
      .select('id, nome, status, temperatura, ultimo_contato, valor_potencial, updated_at')
      .eq('org_id', orgId)
      .in('status', activeStatuses)
      .or(stalledFilter)
      .order('updated_at', { ascending: true })
      .limit(20),
  ])

  if (totalAtivosRes.error || stalledCountRes.error || stalledLeadsRes.error) {
    const dbError = totalAtivosRes.error || stalledCountRes.error || stalledLeadsRes.error
    log('error', 'leads.sla.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/leads/sla',
      error: dbError?.message || 'unknown',
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError?.message || 'Erro ao calcular SLA de leads' },
      500
    )
  }

  const totalAtivos = totalAtivosRes.count || 0
  const totalParados = stalledCountRes.count || 0
  const stalledLeads = stalledLeadsRes.data || []

  const severity = totalParados >= 10 ? 'high' : totalParados >= 4 ? 'medium' : 'low'

  if (totalParados > 0 && stalledLeads[0]?.id) {
    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'LeadSlaBreached',
      entityType: 'lead',
      entityId: stalledLeads[0].id,
      payload: {
        totalStalled: totalParados,
        slaHours,
      },
    }).catch(() => undefined)
  }

  return ok(request, {
    slaHours,
    totalAtivos,
    totalParados,
    severity,
    leadsParados: stalledLeads,
  })
}
