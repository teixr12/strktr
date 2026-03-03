import type { ExecutionSeverity } from '@/shared/types/execution'

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
  generatedAt: string
}
