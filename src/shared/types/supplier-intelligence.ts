import type { BureaucracyRecord } from '@/shared/types/bureaucracy'
import type { SupplierRecord } from '@/shared/types/supplier-management'

export type SupplierRiskState = 'clear' | 'at_risk'

export interface SupplierIntelligenceMetrics {
  supplier_risk_score: number
  overdue_count: number
  next_deadline: string | null
  linked_items_total: number
  open_items_total: number
  risk_state: SupplierRiskState
  threshold_reached: boolean
}

export interface SupplierIntelligencePayload {
  supplier: SupplierRecord
  linkedBureaucracyItems: BureaucracyRecord[]
  metrics: SupplierIntelligenceMetrics
  generatedAt: string
}
