export type PublicApiSurfaceCategory =
  | 'crm'
  | 'operations'
  | 'finance'
  | 'documents'
  | 'automation'
  | 'platform'

export type PublicApiExposureState = 'internal_only' | 'beta_ready' | 'setup_required' | 'planned'

export type PublicApiChecklistStatus = 'ready' | 'blocked' | 'planned'
export type PublicApiClientStatus = 'draft' | 'active' | 'revoked'
export type PublicApiClientExposure = 'internal_only' | 'allowlist' | 'beta' | 'general_blocked'
export type PublicApiClientTokenStatus = 'active' | 'revoked'
export type PublicApiRuntimeStage = 'development' | 'preview' | 'production' | 'unknown'
export type PublicApiUsageOutcome = 'success' | 'error' | 'rate_limited' | 'blocked'
export type PublicApiQuotaStatus = 'healthy' | 'warning' | 'blocked_rate_limit' | 'blocked_daily' | 'blocked_monthly'
export type PublicApiTokenQuotaSource = 'client_default' | 'token_override_partial' | 'token_override_full'

export interface PublicApiSurface {
  code: string
  label: string
  description: string
  category: PublicApiSurfaceCategory
  riskLevel: 'low' | 'medium' | 'high'
  exposureState: PublicApiExposureState
  complianceGated: boolean
  sessionBacked: boolean
  requiresApiKey: boolean
  endpointFamilies: string[]
  recommendedAction: string
}

export interface PublicApiChecklistItem {
  key: string
  label: string
  status: PublicApiChecklistStatus
  detail: string
}

export interface PublicApiScopeDefinition {
  code: string
  label: string
  description: string
  level: 'read' | 'write' | 'admin'
  domains: string[]
  rollout: 'internal_only' | 'beta' | 'general_blocked'
}

export interface PublicApiClientProfile {
  id: string
  org_id: string
  name: string
  status: PublicApiClientStatus
  exposure: PublicApiClientExposure
  scope_codes: string[]
  rate_limit_per_minute: number
  daily_quota: number
  monthly_call_budget: number
  owner_email: string | null
  notes: string | null
  usage?: PublicApiClientUsageSummary
  quota_status?: PublicApiClientQuotaEvaluation
  created_at: string
  updated_at: string
}

export interface PublicApiClientToken {
  id: string
  org_id: string
  client_id: string
  label: string
  status: PublicApiClientTokenStatus
  exposure: PublicApiClientExposure
  token_prefix: string
  token_last_four: string
  rate_limit_per_minute_override: number | null
  daily_quota_override: number | null
  monthly_call_budget_override: number | null
  expires_at: string | null
  last_used_at: string | null
  notes: string | null
  effective_quota?: PublicApiQuotaConfig
  quota_source?: PublicApiTokenQuotaSource
  usage?: PublicApiClientUsageSummary
  quota_status?: PublicApiClientQuotaEvaluation
  created_at: string
  updated_at: string
}

export interface PublicApiClientTokensPayload {
  tokens: PublicApiClientToken[]
  writeEnabled: boolean
  runtimeStage: PublicApiRuntimeStage
}

export interface PublicApiClientTokenCreatePayload {
  item: PublicApiClientToken
  plainToken: string
  writeEnabled: boolean
  runtimeStage: PublicApiRuntimeStage
}

export interface PublicApiClientUsageSummary {
  current_minute_calls: number
  daily_calls: number
  monthly_calls: number
  rate_limit_remaining: number
  daily_quota_remaining: number
  monthly_budget_remaining: number
  last_activity_at: string | null
}

export interface PublicApiQuotaConfig {
  rate_limit_per_minute: number
  daily_quota: number
  monthly_call_budget: number
}

export interface PublicApiClientQuotaEvaluation {
  status: PublicApiQuotaStatus
  would_block: boolean
  reasons: string[]
}

export interface PublicApiClientUsageEvent {
  id: string
  org_id: string
  client_id: string
  token_id: string | null
  source: string
  endpoint_family: string
  outcome: PublicApiUsageOutcome
  call_count: number
  created_at: string
}

export interface PublicApiClientUsagePayload {
  clientId: string
  summary: PublicApiClientUsageSummary
  quota: PublicApiClientQuotaEvaluation
  events: PublicApiClientUsageEvent[]
}

export interface PublicApiClientTokenUsagePayload {
  clientId: string
  tokenId: string
  effective_quota: PublicApiQuotaConfig
  quota_source: PublicApiTokenQuotaSource
  summary: PublicApiClientUsageSummary
  quota: PublicApiClientQuotaEvaluation
  events: PublicApiClientUsageEvent[]
}

export interface PublicApiClientTokenBlockPreviewInput {
  endpoint_family: string
  call_count: number
}

export interface PublicApiClientTokenBlockPreviewPayload extends PublicApiClientTokenBlockPreviewInput {
  clientId: string
  tokenId: string
  effective_quota: PublicApiQuotaConfig
  quota_source: PublicApiTokenQuotaSource
  current_summary: PublicApiClientUsageSummary
  current_quota: PublicApiClientQuotaEvaluation
  projected_summary: PublicApiClientUsageSummary
  projected_quota: PublicApiClientQuotaEvaluation
}

export interface PublicApiReadinessSummary {
  totalSurfaces: number
  internalOnly: number
  betaReady: number
  setupRequired: number
  planned: number
  complianceGated: number
  checklistReady: number
  checklistBlocked: number
}
