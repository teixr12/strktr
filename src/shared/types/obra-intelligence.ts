import type { RecommendedAction } from '@/shared/types/execution'
import type { ObraAlertItem } from '@/shared/types/obra-alerts'

export interface ObraIntelligencePayload {
  obra: {
    id: string
    nome: string
    cliente: string
    status: string
    progresso: number
    data_previsao: string | null
  }
  risk: {
    score: number
    level: 'low' | 'medium' | 'high'
  }
  kpis: {
    etapasTotal: number
    etapasConcluidas: number
    etapasBloqueadas: number
    checklistPendentes: number
    checklistAtrasados: number
    receitas: number
    despesas: number
    saldo: number
  }
  alerts: ObraAlertItem[]
  totals: {
    high: number
    medium: number
    low: number
    total: number
  }
  actionNow: (RecommendedAction & { description: string | null }) | null
  readiness: {
    obraLocationConfigured: boolean
    orgHqConfigured: boolean
    weatherAvailable: boolean
    logisticsReady: boolean
  }
  context: {
    weather: {
      nextHighRiskAt: string | null
      hasMediumRisk: boolean
      forecastDays: number
    } | null
    finance: {
      receitas: number
      despesas: number
      saldo: number
    }
  }
  timeline: Array<{
    id: string
    title: string
    created_at: string
    type: string
  }>
  generatedAt: string
}
