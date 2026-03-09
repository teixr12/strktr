import type {
  BillingKycStatus,
  BillingSubscriptionStatus,
} from '@/shared/types/billing'
import type {
  ProgramDeliveryState,
  ProgramRiskLevel,
  ProgramRolloutState,
} from '@/shared/types/program-status'

export type SuperAdminSurfaceCategory =
  | 'tenancy'
  | 'security'
  | 'observability'
  | 'billing'
  | 'compliance'

export type SuperAdminExposureState = 'internal_only' | 'beta_ready' | 'setup_required' | 'planned'

export type SuperAdminChecklistStatus = 'ready' | 'blocked' | 'planned'

export interface SuperAdminSurface {
  code: string
  label: string
  description: string
  category: SuperAdminSurfaceCategory
  riskLevel: 'medium' | 'high'
  exposureState: SuperAdminExposureState
  complianceGated: boolean
  recommendedAction: string
}

export interface SuperAdminChecklistItem {
  key: string
  label: string
  status: SuperAdminChecklistStatus
  detail: string
}

export interface SuperAdminReadinessSummary {
  totalSurfaces: number
  internalOnly: number
  betaReady: number
  setupRequired: number
  planned: number
  complianceGated: number
  checklistReady: number
  checklistBlocked: number
}

export type SuperAdminBillingGovernanceStatus = 'healthy' | 'attention' | 'blocked'

export interface SuperAdminBillingGovernanceOrg {
  org_id: string
  org_name: string | null
  status: SuperAdminBillingGovernanceStatus
  blockers: string[]
  warnings: string[]
  provider_ready_count: number
  active_plan_count: number
  selected_plan_slug: string | null
  kyc_status: BillingKycStatus
  terms_accepted: boolean
  subscription_status: BillingSubscriptionStatus
  last_event_at: string | null
  last_sync_at: string | null
}

export interface SuperAdminBillingGovernanceSummary {
  serviceRoleReady: boolean
  orgsTracked: number
  healthy: number
  attention: number
  blocked: number
  missingKyc: number
  termsPending: number
  pastDue: number
}

export interface SuperAdminBillingGovernancePayload {
  summary: SuperAdminBillingGovernanceSummary
  orgs: SuperAdminBillingGovernanceOrg[]
}

export interface SuperAdminRolloutGovernanceModule {
  key: string
  title: string
  podKey: string
  podTitle: string
  riskLevel: ProgramRiskLevel
  deliveryState: ProgramDeliveryState
  rolloutState: ProgramRolloutState
  requiresComplianceGate: boolean
  featureEnabled: boolean
  rolloutConfigured: boolean
  rolloutPercent: number
  allowlistCount: number
}

export interface SuperAdminRolloutGovernanceSummary {
  totalModules: number
  liveModules: number
  canaryModules: number
  allowlistModules: number
  blockedModules: number
  offModules: number
  complianceGatedModules: number
  complianceGatedNotLive: number
}

export interface SuperAdminRolloutGovernancePayload {
  summary: SuperAdminRolloutGovernanceSummary
  modules: SuperAdminRolloutGovernanceModule[]
}

export type SuperAdminComplianceGateStatus = 'ready' | 'attention' | 'blocked'

export type SuperAdminComplianceGateSeverity = 'warning' | 'blocker'

export interface SuperAdminComplianceGateCheck {
  key: string
  label: string
  ok: boolean
  severity: SuperAdminComplianceGateSeverity
  detail: string
}

export interface SuperAdminComplianceGateModule {
  key: string
  title: string
  podKey: string
  podTitle: string
  riskLevel: ProgramRiskLevel
  deliveryState: ProgramDeliveryState
  rolloutState: ProgramRolloutState
  status: SuperAdminComplianceGateStatus
  gateReason: string
  recommendedAction: string
  blockerCount: number
  warningCount: number
  checks: SuperAdminComplianceGateCheck[]
}

export interface SuperAdminComplianceGateSummary {
  totalRegulatedModules: number
  ready: number
  attention: number
  blocked: number
  safelyContained: number
  liveWithOpenBlockers: number
}

export interface SuperAdminComplianceGatesPayload {
  summary: SuperAdminComplianceGateSummary
  modules: SuperAdminComplianceGateModule[]
}

export type SuperAdminDomainHealthStatus = 'healthy' | 'attention' | 'blocked'

export interface SuperAdminDomainHealthCheck {
  key: string
  label: string
  ok: boolean
  detail: string
}

export interface SuperAdminDomainHealthItem {
  code: string
  label: string
  status: SuperAdminDomainHealthStatus
  summary: string
  checks: SuperAdminDomainHealthCheck[]
}

export interface SuperAdminDomainHealthSummary {
  healthy: number
  attention: number
  blocked: number
}

export interface SuperAdminDomainHealthPayload {
  summary: SuperAdminDomainHealthSummary
  domains: SuperAdminDomainHealthItem[]
}
