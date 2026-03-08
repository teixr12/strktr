export type BillingProviderCode = 'stripe' | 'mercadopago'
export type BillingSetupState = 'ready' | 'setup_required'
export type BillingExposureState = 'planned' | 'setup_required' | 'beta_ready'
export type BillingChecklistStatus = 'ready' | 'blocked' | 'planned'
export type BillingRuntimeStage = 'development' | 'preview' | 'production' | 'unknown'
export type BillingCheckoutDraftMode = 'disabled' | 'sandbox'
export type BillingPlanStatus = 'draft' | 'active' | 'archived'
export type BillingProviderOperationalStatus = 'planned' | 'sandbox_ready' | 'beta_ready' | 'live_blocked'
export type BillingProviderRolloutMode = 'internal' | 'allowlist' | 'closed_beta' | 'general_blocked'
export type BillingSubscriptionLaunchMode = 'internal_preview' | 'allowlist_beta' | 'general_blocked'
export type BillingKycStatus = 'not_started' | 'in_progress' | 'ready'
export type BillingSubscriptionStatus = 'inactive' | 'sandbox' | 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled'
export type BillingOperationalStatus = 'healthy' | 'attention' | 'blocked'
export type BillingSubscriptionEventType =
  | 'note'
  | 'status_changed'
  | 'trial_started'
  | 'trial_ended'
  | 'renewal_scheduled'
  | 'renewed'
  | 'payment_failed'
  | 'paused'
  | 'resumed'
  | 'canceled'
  | 'manual_override'

export interface BillingProviderStatus {
  code: BillingProviderCode
  label: string
  description: string
  configured: boolean
  riskLevel: 'medium' | 'high'
  setupState: BillingSetupState
  envKeys: string[]
  recommendedAction: string
}

export interface BillingChecklistItem {
  key: string
  label: string
  status: BillingChecklistStatus
  detail: string
}

export interface BillingSurface {
  code: string
  label: string
  description: string
  exposureState: BillingExposureState
  complianceGated: boolean
  recommendedAction: string
}

export interface BillingOrgProfile {
  orgName: string | null
  plan: string | null
  cnpj: string | null
  profileReady: boolean
}

export interface BillingAdminSettings {
  id: string | null
  org_id: string
  default_provider: BillingProviderCode
  billing_email: string | null
  support_email: string | null
  terms_url: string | null
  privacy_url: string | null
  checkout_enabled: boolean
  sandbox_mode: boolean
  trial_days: number
  monthly_price_cents: number | null
  annual_price_cents: number | null
  created_at: string | null
  updated_at: string | null
}

export interface BillingAdminSettingsPayload {
  settings: BillingAdminSettings
  writeEnabled: boolean
  runtimeStage: BillingRuntimeStage
}

export interface BillingCheckoutDraft {
  id: string | null
  org_id: string
  plan_slug: string
  headline: string | null
  subheadline: string | null
  currency: string
  monthly_price_cents: number | null
  annual_price_cents: number | null
  trial_days_override: number | null
  primary_cta_label: string | null
  accepted_providers: BillingProviderCode[]
  feature_bullets: string[]
  mode: BillingCheckoutDraftMode
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface BillingCheckoutDraftPayload {
  draft: BillingCheckoutDraft
  writeEnabled: boolean
  runtimeStage: BillingRuntimeStage
}

export interface BillingPlanCatalogItem {
  id: string
  org_id: string
  slug: string
  name: string
  description: string | null
  status: BillingPlanStatus
  currency: string
  monthly_price_cents: number | null
  annual_price_cents: number | null
  trial_days: number
  accepted_providers: BillingProviderCode[]
  feature_bullets: string[]
  featured: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BillingPlanCatalogPayload {
  items: BillingPlanCatalogItem[]
  writeEnabled: boolean
  runtimeStage: BillingRuntimeStage
}

export interface BillingProviderSetting {
  id: string | null
  org_id: string
  provider_code: BillingProviderCode
  operational_status: BillingProviderOperationalStatus
  rollout_mode: BillingProviderRolloutMode
  account_reference: string | null
  publishable_key_hint: string | null
  webhook_endpoint_hint: string | null
  settlement_country: string | null
  accepted_currencies: string[]
  supports_pix: boolean
  supports_cards: boolean
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface BillingProviderSettingsPayload {
  items: BillingProviderSetting[]
  writeEnabled: boolean
  runtimeStage: BillingRuntimeStage
}

export interface BillingSubscriptionReadiness {
  id: string | null
  org_id: string
  selected_plan_slug: string | null
  preferred_provider: BillingProviderCode
  billing_contact_name: string | null
  billing_contact_email: string | null
  finance_owner_name: string | null
  finance_owner_email: string | null
  company_legal_name: string | null
  company_address: string | null
  launch_mode: BillingSubscriptionLaunchMode
  kyc_status: BillingKycStatus
  terms_accepted: boolean
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface BillingSubscriptionReadinessPayload {
  readiness: BillingSubscriptionReadiness
  writeEnabled: boolean
  runtimeStage: BillingRuntimeStage
}

export interface BillingSubscriptionState {
  id: string | null
  org_id: string
  status: BillingSubscriptionStatus
  provider_code: BillingProviderCode
  plan_slug: string | null
  external_customer_ref: string | null
  external_subscription_ref: string | null
  current_period_start_at: string | null
  current_period_end_at: string | null
  trial_ends_at: string | null
  cancel_at_period_end: boolean
  auto_renew: boolean
  launched_at: string | null
  last_synced_at: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface BillingSubscriptionStatePayload {
  subscription: BillingSubscriptionState
  writeEnabled: boolean
  runtimeStage: BillingRuntimeStage
}

export interface BillingSubscriptionEvent {
  id: string
  org_id: string
  event_type: BillingSubscriptionEventType
  actor_label: string | null
  summary: string
  details: string | null
  status_before: BillingSubscriptionStatus | null
  status_after: BillingSubscriptionStatus | null
  provider_code: BillingProviderCode | null
  effective_at: string
  created_at: string
}

export interface BillingSubscriptionEventsPayload {
  events: BillingSubscriptionEvent[]
  writeEnabled: boolean
  runtimeStage: BillingRuntimeStage
}

export interface BillingOperationalSummarySnapshot {
  providerConfiguredCount: number
  providerReadyCount: number
  activePlanCount: number
  featuredPlanSlug: string | null
  preferredProvider: BillingProviderCode
  launchMode: BillingSubscriptionLaunchMode
  kycStatus: BillingKycStatus
  termsAccepted: boolean
  subscriptionStatus: BillingSubscriptionStatus
  lastEventAt: string | null
  lastSyncAt: string | null
}

export interface BillingOperationalSummary {
  status: BillingOperationalStatus
  blockers: string[]
  warnings: string[]
  snapshot: BillingOperationalSummarySnapshot
}

export interface BillingOperationalSummaryPayload {
  summary: BillingOperationalSummary
}

export interface BillingReadinessSummary {
  totalProviders: number
  readyProviders: number
  setupRequiredProviders: number
  betaReadySurfaces: number
  plannedSurfaces: number
  complianceGatedSurfaces: number
  checklistReady: number
  checklistBlocked: number
}
