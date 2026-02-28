export const ANALYTICS_EVENT_TYPES = [
  'LeadCreated',
  'LeadNextActionSuggested',
  'LeadSlaBreached',
  'EtapaStatusChanged',
  'ChecklistItemToggled',
  'RiskRecalculated',
  'BudgetDeviationDetected',
  'PageViewed',
  'OnboardingStepCompleted',
  'auth_sign_up',
  'auth_login',
  'auth_logout',
  'activation_first_value_action',
  'core_create',
  'core_edit',
  'core_delete',
  'core_move',
  'core_complete',
  'reliability_api_error',
  'reliability_client_error',
  'reliability_latency_bucket',
  'portal_invite_sent',
  'portal_comment_created',
  'portal_approval_decision',
] as const

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number]

export type AnalyticsOutcome = 'success' | 'fail'

export type AnalyticsSource =
  | 'web'
  | 'dashboard'
  | 'leads'
  | 'obras'
  | 'portal'
  | 'system'

export interface AnalyticsProps {
  user_id?: string | null
  org_id?: string | null
  role?: string | null
  route?: string | null
  entity_id?: string | null
  entity_type?: string | null
  outcome?: AnalyticsOutcome
  source?: AnalyticsSource
  requestId?: string | null
  [key: string]: unknown
}

export interface AnalyticsTrackInput {
  eventType: AnalyticsEventType
  entityType?: string
  entityId?: string
  payload?: AnalyticsProps
}
