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

  const { data: leads, error: dbError } = await supabase
    .from('leads')
    .select('id, nome, status, temperatura, ultimo_contato, valor_potencial, updated_at')
    .eq('org_id', orgId)
    .in('status', ['Novo', 'Qualificado', 'Proposta', 'Negociação'])
    .order('updated_at', { ascending: false })
    .limit(200)

  if (dbError) {
    log('error', 'leads.sla.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/leads/sla',
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      500
    )
  }

  const stalled = (leads || []).filter((lead) => {
    const checkpoint = lead.ultimo_contato || lead.updated_at
    if (!checkpoint) return true
    const hours = (now - new Date(checkpoint).getTime()) / (1000 * 60 * 60)
    return hours >= slaHours
  })

  const severity = stalled.length >= 10 ? 'high' : stalled.length >= 4 ? 'medium' : 'low'

  if (stalled.length > 0) {
    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'LeadSlaBreached',
      entityType: 'lead',
      entityId: stalled[0].id,
      payload: {
        totalStalled: stalled.length,
        slaHours,
      },
    }).catch(() => undefined)
  }

  return ok(request, {
    slaHours,
    totalAtivos: leads?.length || 0,
    totalParados: stalled.length,
    severity,
    leadsParados: stalled.slice(0, 20),
  })
}
