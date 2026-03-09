export type BigDataSurfaceCategory =
  | 'collection'
  | 'privacy'
  | 'analytics'
  | 'insights'
  | 'platform'

export type BigDataExposureState = 'internal_only' | 'beta_ready' | 'setup_required' | 'planned'

export type BigDataChecklistStatus = 'ready' | 'blocked' | 'planned'

export interface BigDataSurface {
  code: string
  label: string
  description: string
  category: BigDataSurfaceCategory
  riskLevel: 'medium' | 'high'
  exposureState: BigDataExposureState
  complianceGated: boolean
  recommendedAction: string
}

export interface BigDataChecklistItem {
  key: string
  label: string
  status: BigDataChecklistStatus
  detail: string
}

export interface BigDataReadinessSummary {
  totalSurfaces: number
  internalOnly: number
  betaReady: number
  setupRequired: number
  planned: number
  complianceGated: number
  checklistReady: number
  checklistBlocked: number
}
