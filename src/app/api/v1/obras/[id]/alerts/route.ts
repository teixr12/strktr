import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { fetchExecutionContext } from '@/server/repositories/obras/execution-repository'
import { buildExecutionSummary } from '@/server/services/obras/execution-summary-service'
import type { ObraAlertItem, ObraAlertsPayload } from '@/shared/types/obra-alerts'

function withCashFlowAlerts(alerts: ObraAlertItem[], saldo: number, despesas: number) {
  const next = [...alerts]
  if (saldo < 0) {
    next.push({
      code: 'CASHFLOW_NEGATIVE',
      title: 'Fluxo de caixa negativo na obra',
      severity: 'high',
      message: 'Despesas superaram receitas. Priorize replanejamento financeiro imediato.',
    })
  } else if (despesas > 0 && saldo < despesas * 0.2) {
    next.push({
      code: 'CASHFLOW_LOW',
      title: 'Reserva de caixa baixa para execução',
      severity: 'medium',
      message: 'Saldo disponível abaixo de 20% das despesas acumuladas da obra.',
    })
  }
  return next
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  const { obraRes, etapasRes, checklistsRes, txRes, diarioRes } = await fetchExecutionContext(
    supabase,
    id,
    orgId
  )

  if (obraRes.error || !obraRes.data) {
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' },
      404
    )
  }

  if (etapasRes.error || checklistsRes.error || txRes.error || diarioRes.error) {
    log('error', 'obras.alerts.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/alerts',
      obraId: id,
      error:
        etapasRes.error?.message ||
        checklistsRes.error?.message ||
        txRes.error?.message ||
        diarioRes.error?.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: 'Falha ao montar alertas da obra' },
      500
    )
  }

  const summary = buildExecutionSummary({
    etapas: etapasRes.data ?? [],
    checklists: checklistsRes.data ?? [],
    transacoes: txRes.data ?? [],
    lastDiaryDate: diarioRes.data?.created_at || null,
  })

  const alerts = withCashFlowAlerts(
    (summary.alerts || []).map((alert) => ({
      code: alert.code,
      title: alert.title,
      severity: alert.severity,
    })),
    summary.kpis.saldo,
    summary.kpis.despesas
  )

  const payload: ObraAlertsPayload = {
    obra: {
      id: obraRes.data.id,
      nome: obraRes.data.nome,
      status: obraRes.data.status,
    },
    risk: summary.risk,
    alerts,
    totals: {
      high: alerts.filter((item) => item.severity === 'high').length,
      medium: alerts.filter((item) => item.severity === 'medium').length,
      low: alerts.filter((item) => item.severity === 'low').length,
      total: alerts.length,
    },
    generatedAt: new Date().toISOString(),
  }

  return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_OBRA_ALERTS_V1' })
}
