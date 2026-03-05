import type { ExecutionSeverity } from '@/shared/types/execution'
import type { ObraWeatherDay } from '@/shared/types/obra-weather'

export interface ObraAlertItem {
  code: string
  title: string
  severity: ExecutionSeverity
  message?: string
}

export interface ObraAlertsPayload {
  obra: {
    id: string
    nome: string
    status: string
  }
  risk: {
    score: number
    level: ExecutionSeverity
  }
  alerts: ObraAlertItem[]
  totals: {
    high: number
    medium: number
    low: number
    total: number
  }
  context?: {
    weather?: {
      generatedAt: string
      nextHighRiskAt: string | null
      hasMediumRisk: boolean
      days: ObraWeatherDay[]
    }
    logistics?: {
      locationConfigured: boolean
      source: 'obra_geolocation'
    }
  }
  generatedAt: string
}
