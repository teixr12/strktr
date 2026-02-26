import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductEventType =
  | 'LeadCreated'
  | 'LeadNextActionSuggested'
  | 'LeadSlaBreached'
  | 'EtapaStatusChanged'
  | 'ChecklistItemToggled'
  | 'RiskRecalculated'
  | 'BudgetDeviationDetected'
  | 'PageViewed'
  | 'OnboardingStepCompleted'

interface ProductEventInput {
  supabase: SupabaseClient
  orgId?: string | null
  userId: string
  eventType: ProductEventType
  entityType: string
  entityId: string
  payload?: Record<string, unknown>
}

export async function emitProductEvent(input: ProductEventInput) {
  // If the table is not available yet, do not break runtime flows.
  await input.supabase.from('eventos_produto').insert({
    org_id: input.orgId ?? null,
    user_id: input.userId,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    payload: input.payload ?? {},
  })
}
