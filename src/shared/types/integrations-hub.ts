export type IntegrationHubCode =
  | 'whatsapp_business'
  | 'google_calendar'
  | 'resend'
  | 'posthog'
  | 'stripe'
  | 'mercadopago'
  | 'notion'
  | 'slack'
  | 'google_sheets'
  | 'webhooks'
  | 'sicoob_api'

export type IntegrationHubCategory =
  | 'communication'
  | 'calendar'
  | 'analytics'
  | 'billing'
  | 'documents'
  | 'automation'
  | 'finance'

export type IntegrationHubProviderSettingStatus = 'draft' | 'configured' | 'blocked'
export type IntegrationHubProviderRollout = 'disabled' | 'sandbox' | 'beta' | 'live'
export type IntegrationHubRuntimeStage = 'development' | 'preview' | 'production' | 'unknown'

export interface IntegrationHubItem {
  code: IntegrationHubCode
  label: string
  description: string
  category: IntegrationHubCategory
  configured: boolean
  configuredBy: 'environment' | 'database' | 'unknown'
  riskLevel: 'low' | 'medium' | 'high'
  setupState: 'ready' | 'setup_required'
  recommendedAction: string
  envKeys: string[]
}

export interface IntegrationHubProviderSetting {
  id: string | null
  org_id: string
  provider_code: IntegrationHubCode
  enabled: boolean
  status: IntegrationHubProviderSettingStatus
  rollout_mode: IntegrationHubProviderRollout
  owner_email: string | null
  callback_url: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface IntegrationHubSettingsPayload {
  settings: IntegrationHubProviderSetting[]
  writeEnabled: boolean
  runtimeStage: IntegrationHubRuntimeStage
}

export interface IntegrationHubSummary {
  total: number
  configured: number
  setupRequired: number
  communication: number
  billing: number
  analytics: number
}
