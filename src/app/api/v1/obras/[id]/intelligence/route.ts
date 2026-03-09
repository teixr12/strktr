import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withObraIntelligenceAuth } from '@/lib/obra-intelligence/api'
import { fetchOrgHqLocationByOrg } from '@/server/repositories/config/org-hq-repository'
import { fetchExecutionContext } from '@/server/repositories/obras/execution-repository'
import { fetchObraLocationByOrg } from '@/server/repositories/obras/location-repository'
import { isWave2FeatureEnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { buildExecutionSummary } from '@/server/services/obras/execution-summary-service'
import { fetchOpenMeteoForecast } from '@/server/services/obras/weather-service'
import type { ObraAlertItem } from '@/shared/types/obra-alerts'
import type { ObraIntelligencePayload } from '@/shared/types/obra-intelligence'

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

function describeAction(code: string) {
  const descriptions: Record<string, string> = {
    RESOLVE_BLOCKED_STAGE: 'Existem etapas bloqueadas impactando o cronograma.',
    HANDLE_OVERDUE_CHECKLIST: 'Existem checklists vencidos exigindo ação imediata.',
    START_STAGE_PROGRESS: 'Existem etapas sem progresso registrado recentemente.',
    ADD_DAILY_NOTE: 'O diário está desatualizado e pode causar perda de contexto.',
    RECALCULATE_RISK: 'Recalcule o risco para atualizar decisões operacionais.',
  }
  return descriptions[code] || null
}

export const GET = withObraIntelligenceAuth('can_manage_projects', async (request, { supabase, orgId }) => {
  const pathname = new URL(request.url).pathname
  const obraId = pathname.split('/').filter(Boolean).at(-2)
  if (!obraId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Obra inválida' }, 400)
  }

  const [execution, obraLocationRes, orgHqRes, timelineRes] = await Promise.all([
    fetchExecutionContext(supabase, obraId, orgId),
    fetchObraLocationByOrg(supabase, obraId, orgId),
    fetchOrgHqLocationByOrg(supabase, orgId),
    supabase
      .from('diario_obra')
      .select('id, titulo, tipo, created_at')
      .eq('obra_id', obraId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  if (execution.obraRes.error || !execution.obraRes.data) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  if (
    execution.etapasRes.error ||
    execution.checklistsRes.error ||
    execution.txRes.error ||
    execution.diarioRes.error ||
    obraLocationRes.error ||
    orgHqRes.error ||
    timelineRes.error
  ) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: 'Falha ao montar inteligência da obra' },
      500
    )
  }

  const summary = buildExecutionSummary({
    etapas: execution.etapasRes.data ?? [],
    checklists: execution.checklistsRes.data ?? [],
    transacoes: execution.txRes.data ?? [],
    lastDiaryDate: execution.diarioRes.data?.created_at || null,
  })

  const locationConfigured = Boolean(obraLocationRes.data)
  const hqConfigured = Boolean(orgHqRes.data)

  let weatherContext: ObraIntelligencePayload['context']['weather'] = null
  const alerts = withCashFlowAlerts(
    (summary.alerts || []).map((alert) => ({
      code: alert.code,
      title: alert.title,
      severity: alert.severity,
    })),
    summary.kpis.saldo,
    summary.kpis.despesas
  )

  if (locationConfigured && isWave2FeatureEnabledForOrg('weatherAlerts', orgId)) {
    try {
      const weather = await fetchOpenMeteoForecast({
        lat: Number(obraLocationRes.data?.lat),
        lng: Number(obraLocationRes.data?.lng),
        forecastDays: 3,
      })
      const nextHighRisk = weather.days.find((day) => day.severity === 'high')
      const hasMediumRisk = weather.days.some((day) => day.severity === 'medium')

      weatherContext = {
        nextHighRiskAt: nextHighRisk?.date || null,
        hasMediumRisk,
        forecastDays: weather.days.length,
      }

      if (nextHighRisk) {
        alerts.push({
          code: 'WEATHER_HIGH_RISK',
          title: 'Risco climático alto nos próximos dias',
          severity: 'high',
          message: `Condição crítica prevista para ${nextHighRisk.date}.`,
        })
      } else if (hasMediumRisk) {
        alerts.push({
          code: 'WEATHER_MEDIUM_RISK',
          title: 'Atenção climática para etapas externas',
          severity: 'medium',
          message: 'Condições moderadas previstas. Considere ajustes de logística e cronograma.',
        })
      }
    } catch {
      weatherContext = null
    }
  }

  if (!locationConfigured) {
    alerts.push({
      code: 'OBRA_LOCATION_MISSING',
      title: 'Defina a localização da obra',
      severity: 'medium',
      message: 'Sem localização não é possível prever clima nem apoiar a logística.',
    })
  }

  if (!hqConfigured) {
    alerts.push({
      code: 'ORG_HQ_MISSING',
      title: 'Defina a sede da organização',
      severity: 'medium',
      message: 'Sem sede configurada o cálculo padrão de deslocamento fica incompleto.',
    })
  }

  const payload: ObraIntelligencePayload = {
    obra: {
      id: execution.obraRes.data.id,
      nome: execution.obraRes.data.nome,
      cliente: execution.obraRes.data.cliente,
      status: execution.obraRes.data.status,
      progresso: execution.obraRes.data.progresso,
      data_previsao: execution.obraRes.data.data_previsao,
    },
    risk: summary.risk,
    kpis: {
      etapasTotal: summary.kpis.etapasTotal,
      etapasConcluidas: summary.kpis.etapasConcluidas,
      etapasBloqueadas: summary.kpis.etapasBloqueadas,
      checklistPendentes: summary.kpis.checklistPendentes,
      checklistAtrasados: summary.kpis.checklistAtrasados,
      receitas: summary.kpis.receitas,
      despesas: summary.kpis.despesas,
      saldo: summary.kpis.saldo,
    },
    alerts,
    totals: {
      high: alerts.filter((item) => item.severity === 'high').length,
      medium: alerts.filter((item) => item.severity === 'medium').length,
      low: alerts.filter((item) => item.severity === 'low').length,
      total: alerts.length,
    },
    actionNow: summary.recommendedActions[0]
      ? {
          ...summary.recommendedActions[0],
          description: describeAction(summary.recommendedActions[0].code),
        }
      : null,
    readiness: {
      obraLocationConfigured: locationConfigured,
      orgHqConfigured: hqConfigured,
      weatherAvailable: Boolean(weatherContext),
      logisticsReady: locationConfigured && hqConfigured,
    },
    context: {
      weather: weatherContext,
      finance: {
        receitas: summary.kpis.receitas,
        despesas: summary.kpis.despesas,
        saldo: summary.kpis.saldo,
      },
    },
    timeline: (timelineRes.data || []).map((entry) => ({
      id: entry.id,
      title: entry.titulo || entry.tipo || 'Atualização',
      created_at: entry.created_at,
      type: entry.tipo || 'nota',
    })),
    generatedAt: new Date().toISOString(),
  }

  return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_OBRA_INTELLIGENCE_V1' })
})
