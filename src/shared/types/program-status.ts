export type ProgramPodKey = 'podA' | 'podB' | 'podC'

export type ProgramRiskLevel = 'low' | 'medium' | 'high'

export type ProgramDeliveryState = 'implemented' | 'in_progress' | 'planned'

export type ProgramRolloutState = 'off' | 'blocked' | 'allowlist' | 'canary' | 'live'

export type ProgramReleaseTrainKey = 'trainA' | 'trainB' | 'trainC'

export type ProgramReleaseTrainStage = 'current' | 'next' | 'later'

export type ProgramExecutionClassification =
  | 'core_certification'
  | 'pod_b_rollout'
  | 'platform_hardening'
  | 'runtime_foundation'
  | 'regulated_platform_later'
  | 'backlog_non_critical'

export type ProgramExecutionPhase =
  | 'phase0_core_certification'
  | 'phase1_pod_b_rollout'
  | 'phase2_platform_hardening'
  | 'phase3_runtime_foundation'
  | 'phase4_regulated_platform_later'

export type ProgramStructuralGapKey =
  | 'durable_jobs'
  | 'distributed_idempotency'
  | 'distributed_rate_limiting'
  | 'workflow_event_backbone'
  | 'search_index_layer'
  | 'ai_data_flywheel'

export const PROGRAM_MODULE_KEYS = [
  'financeReceipts',
  'financeReceiptAi',
  'cronogramaUxV2',
  'docsWorkspace',
  'portalAdminV2',
  'obraIntelligenceV1',
  'financeDepthV1',
  'supplierManagementV1',
  'bureaucracyV1',
  'emailTriageV1',
  'billingV1',
  'referralV1',
  ['public', 'ApiV1'].join(''),
  ['integrations', 'HubV1'].join(''),
  ['super', 'AdminV1'].join(''),
  ['agent', 'ReadyV1'].join(''),
  ['big', 'DataV1'].join(''),
  ['open', 'BankingV1'].join(''),
] as const

export type ProgramModuleKey = (typeof PROGRAM_MODULE_KEYS)[number]

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

export interface ProgramExecutionTaskStatus {
  key: string
  title: string
  classification: ProgramExecutionClassification
  allowedNow: boolean
  dependencies: string[]
  operationalRisk: ProgramRiskLevel
  safestRolloutPath: string
  rollbackStrategy: string
  blockingReasons: string[]
}

export interface ProgramStructuralGapStatus {
  key: ProgramStructuralGapKey
  title: string
  status: 'open' | 'closed'
  requiredBefore: ProgramExecutionClassification[]
  reason: string
}

export interface ProgramCoreCertificationStatus {
  liveCoreModulesReady: boolean
  releaseTraceabilityVerified: boolean
  authStrictE2EStable: boolean
  rollbackDrillsDocumented: boolean
  closeoutPublished: boolean
}

export interface ProgramExecutionControl {
  governingRule: 'certify_harden_expand'
  currentPhase: ProgramExecutionPhase
  liveCoreModules: ProgramModuleKey[]
  certification: ProgramCoreCertificationStatus
  structuralGaps: ProgramStructuralGapStatus[]
  allowedNow: ProgramExecutionTaskStatus[]
  blockedNow: ProgramExecutionTaskStatus[]
  violations: string[]
  enforcementRules: string[]
}

export interface ProgramStatusPayload {
  horizonDays: number
  strategy: 'modular_monolith'
  rolloutPolicy: 'org_canary'
  regulatedGeneralReleasePolicy: 'blocked-until-compliance'
  pods: ProgramPodStatus[]
  releaseTrains: ProgramReleaseTrainStatus[]
  executionControl: ProgramExecutionControl
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
  executionControl: {
    currentPhase: ProgramExecutionPhase
    allowedNowCount: number
    blockedNowCount: number
    openStructuralGapCount: number
    liveCoreModulesReady: boolean
    releaseTraceabilityVerified: boolean
    authStrictE2EStable: boolean
    rollbackDrillsDocumented: boolean
    closeoutPublished: boolean
    violationCount: number
  }
  totals: {
    totalModules: number
    liveModules: number
    canaryModules: number
    allowlistModules: number
    blockedModules: number
    complianceGatedModules: number
  }
}
