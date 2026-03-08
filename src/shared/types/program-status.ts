export type ProgramPodKey = 'podA' | 'podB' | 'podC'

export type ProgramRiskLevel = 'low' | 'medium' | 'high'

export type ProgramDeliveryState = 'implemented' | 'in_progress' | 'planned'

export type ProgramRolloutState = 'off' | 'blocked' | 'allowlist' | 'canary' | 'live'

export type ProgramReleaseTrainKey = 'trainA' | 'trainB' | 'trainC'

export type ProgramReleaseTrainStage = 'current' | 'next' | 'later'

export type ProgramModuleKey =
  | 'financeReceipts'
  | 'financeReceiptAi'
  | 'cronogramaUxV2'
  | 'docsWorkspace'
  | 'portalAdminV2'
  | 'obraIntelligenceV1'
  | 'financeDepthV1'
  | 'supplierManagementV1'
  | 'bureaucracyV1'
  | 'emailTriageV1'
  | 'billingV1'
  | 'referralV1'
  | 'publicApiV1'
  | 'integrationsHubV1'
  | 'superAdminV1'
  | 'agentReadyV1'
  | 'bigDataV1'
  | 'openBankingV1'

export interface ProgramModuleStatus {
  key: ProgramModuleKey
  title: string
  pod: ProgramPodKey
  order: number
  riskLevel: ProgramRiskLevel
  deliveryState: ProgramDeliveryState
  requiresComplianceGate: boolean
  featureFlagName: string
  featureEnabled: boolean
  rolloutName: string | null
  rolloutState: ProgramRolloutState
  rollout: {
    configured: boolean
    percent: number
    allowlistCount: number
    source: string | null
  } | null
}

export interface ProgramPodStatus {
  key: ProgramPodKey
  title: string
  summary: {
    totalModules: number
    implementedModules: number
    inProgressModules: number
    plannedModules: number
    liveModules: number
    canaryModules: number
    allowlistModules: number
    blockedModules: number
  }
  modules: ProgramModuleStatus[]
}

export interface ProgramReleaseTrainStatus {
  key: ProgramReleaseTrainKey
  title: string
  order: number
  stage: ProgramReleaseTrainStage
  objective: string
  deployPolicy: 'all_flags_off'
  dependsOn: ProgramReleaseTrainKey[]
  affectedModules: ProgramModuleKey[]
  scope: string[]
  blockers: string[]
}

export interface ProgramStatusPayload {
  horizonDays: number
  strategy: 'modular_monolith'
  rolloutPolicy: 'org_canary'
  regulatedGeneralReleasePolicy: 'blocked-until-compliance'
  pods: ProgramPodStatus[]
  releaseTrains: ProgramReleaseTrainStatus[]
  summary: {
    totalModules: number
    implementedModules: number
    inProgressModules: number
    plannedModules: number
    liveModules: number
    canaryModules: number
    allowlistModules: number
    blockedModules: number
    complianceGatedModules: number
  }
}

export interface ProgramHealthSummary {
  horizonDays: number
  rolloutPolicy: 'org_canary'
  regulatedGeneralReleasePolicy: 'blocked-until-compliance'
  pods: Array<{
    key: ProgramPodKey
    title: string
    totalModules: number
    liveModules: number
    canaryModules: number
    allowlistModules: number
    blockedModules: number
  }>
  releaseTrains: Array<{
    key: ProgramReleaseTrainKey
    title: string
    stage: ProgramReleaseTrainStage
    affectedModuleCount: number
    blockerCount: number
  }>
  totals: {
    totalModules: number
    liveModules: number
    canaryModules: number
    allowlistModules: number
    blockedModules: number
    complianceGatedModules: number
  }
}
