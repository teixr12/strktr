import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { emitProductEvent } from '@/lib/telemetry'
import { requireExecutionPermission } from '@/lib/auth/execution-permissions'
import { fetchExecutionContext } from '@/server/repositories/obras/execution-repository'
import { buildExecutionSummary } from '@/server/services/obras/execution-summary-service'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled('executionRiskEngine')) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Engine de risco desabilitada' }, 403)
  }

  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireExecutionPermission(request, role, 'can_recalculate_risk')
  if (permissionError) return permissionError

  const { id } = await params
  const { obraRes, etapasRes, checklistsRes, diarioRes } = await fetchExecutionContext(supabase, id, orgId)

  if (!obraRes.data) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }
  if (etapasRes.error || checklistsRes.error || diarioRes.error) {
    log('error', 'obras.risk.recalculate.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/risks/recalculate',
      obraId: id,
      error: etapasRes.error?.message || checklistsRes.error?.message || diarioRes.error?.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: 'Falha ao recalcular risco' }, 500)
  }

  const summary = buildExecutionSummary({
    etapas: etapasRes.data ?? [],
    checklists: checklistsRes.data ?? [],
    transacoes: [],
    lastDiaryDate: diarioRes.data?.created_at || null,
  })

  const score = summary.risk.score
  const level = summary.risk.level
  const blocked = summary.kpis.etapasBloqueadas
  const overdue = summary.kpis.checklistAtrasados

  await supabase.from('diario_obra').insert({
    obra_id: id,
    user_id: user.id,
    org_id: orgId,
    tipo: 'status_change',
    titulo: `Risco recalculado (${level.toUpperCase()})`,
    descricao: `Score atualizado para ${score}`,
    metadata: { score, level, blocked, overdue },
  })

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'RiskRecalculated',
    entityType: 'obra',
    entityId: id,
    payload: { score, level, blocked, overdue },
  }).catch(() => undefined)

  return ok(request, {
    score,
    level,
    blocked,
    overdue,
    recommendedActions: summary.recommendedActions,
  })
}
