export type OpenBankingSurfaceCategory =
  | 'consent'
  | 'accounts'
  | 'reconciliation'
  | 'security'
  | 'platform'

export type OpenBankingExposureState = 'internal_only' | 'beta_ready' | 'setup_required' | 'planned'

export type OpenBankingChecklistStatus = 'ready' | 'blocked' | 'planned'

export interface OpenBankingSurface {
  code: string
  label: string
  description: string
  category: OpenBankingSurfaceCategory
  riskLevel: 'medium' | 'high'
  exposureState: OpenBankingExposureState
  complianceGated: boolean
  recommendedAction: string
}

export interface OpenBankingChecklistItem {
  key: string
  label: string
  status: OpenBankingChecklistStatus
  detail: string
}

export interface OpenBankingReadinessSummary {
  totalSurfaces: number
  internalOnly: number
  betaReady: number
  setupRequired: number
  planned: number
  complianceGated: number
  checklistReady: number
  checklistBlocked: number
}
