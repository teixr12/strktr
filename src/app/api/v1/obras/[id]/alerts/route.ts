import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { isFlagDisabledByDefault } from '@/lib/feature-flags'
import { fetchExecutionContext } from '@/server/repositories/obras/execution-repository'
import { fetchObraLocationByOrg } from '@/server/repositories/obras/location-repository'
import { buildExecutionSummary } from '@/server/services/obras/execution-summary-service'
import { fetchOpenMeteoForecast } from '@/server/services/obras/weather-service'
import type { ObraAlertItem, ObraAlertsPayload } from '@/shared/types/obra-alerts'
import type { ObraWeatherDay } from '@/shared/types/obra-weather'

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

async function withWeatherSignals(params: {
  supabase: NonNullable<Awaited<ReturnType<typeof getApiUser>>['supabase']>
  orgId: string
  obraId: string
  alerts: ObraAlertItem[]
}) {
  const weatherAlertsEnabled = isFlagDisabledByDefault(
    process.env.NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1
  )
  if (!weatherAlertsEnabled) {
    return {
      alerts: params.alerts,
      weatherContext: undefined,
      logisticsContext: undefined,
    }
  }

  const locationRes = await fetchObraLocationByOrg(params.supabase, params.obraId, params.orgId)
  const location = locationRes.data

  const nextAlerts = [...params.alerts]
  if (!location) {
    nextAlerts.push({
      code: 'LOGISTICS_LOCATION_MISSING',
      title: 'Defina localização da obra para alertas externos',
      severity: 'medium',
      message: 'Sem coordenadas da obra não é possível prever impacto climático e logístico.',
    })
    return {
      alerts: nextAlerts,
      weatherContext: undefined,
      logisticsContext: {
        locationConfigured: false,
        source: 'obra_geolocation' as const,
      },
    }
  }

  let weatherDays: ObraWeatherDay[] = []
  try {
    const weather = await fetchOpenMeteoForecast({
      lat: Number(location.lat),
      lng: Number(location.lng),
      forecastDays: 3,
    })
    weatherDays = weather.days
  } catch {
    // Keep alerts path resilient; weather provider is best effort.
  }

  const nextHighRisk = weatherDays.find((day) => day.severity === 'high')
  const hasMediumRisk = weatherDays.some((day) => day.severity === 'medium')
  if (nextHighRisk) {
    nextAlerts.push({
      code: 'WEATHER_HIGH_RISK',
      title: 'Risco climático alto nos próximos dias',
      severity: 'high',
      message: `Condição crítica prevista para ${nextHighRisk.date}. Reavalie etapas externas.`,
    })
  } else if (hasMediumRisk) {
    nextAlerts.push({
      code: 'WEATHER_MEDIUM_RISK',
      title: 'Atenção climática para etapas externas',
      severity: 'medium',
      message: 'Condições moderadas previstas. Considere ajustes de logística e cronograma.',
    })
  }

  return {
    alerts: nextAlerts,
    weatherContext: {
      generatedAt: new Date().toISOString(),
      nextHighRiskAt: nextHighRisk?.date || null,
      hasMediumRisk,
      days: weatherDays,
    },
    logisticsContext: {
      locationConfigured: true,
      source: 'obra_geolocation' as const,
    },
  }
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

  const baseAlerts = withCashFlowAlerts(
    (summary.alerts || []).map((alert) => ({
      code: alert.code,
      title: alert.title,
      severity: alert.severity,
    })),
    summary.kpis.saldo,
    summary.kpis.despesas
  )

  const weatherSignals = await withWeatherSignals({
    supabase,
    orgId,
    obraId: id,
    alerts: baseAlerts,
  })
  const alerts = weatherSignals.alerts

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
    context:
      weatherSignals.weatherContext || weatherSignals.logisticsContext
        ? {
            weather: weatherSignals.weatherContext,
            logistics: weatherSignals.logisticsContext,
          }
        : undefined,
    generatedAt: new Date().toISOString(),
  }

  return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_OBRA_ALERTS_V1' })
}
