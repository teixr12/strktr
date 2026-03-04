import type { SupabaseClient } from '@supabase/supabase-js'

interface ConstructionAuditInput {
  supabase: SupabaseClient
  orgId: string
  actorUserId: string | null
  eventType: string
  projectId?: string | null
  visitId?: string | null
  documentId?: string | null
  payload?: Record<string, unknown>
}

export async function appendConstructionAudit(input: ConstructionAuditInput) {
  await input.supabase.from('construction_docs_audit_logs').insert({
    org_id: input.orgId,
    project_id: input.projectId || null,
    visit_id: input.visitId || null,
    document_id: input.documentId || null,
    event_type: input.eventType,
    actor_user_id: input.actorUserId,
    payload: input.payload || {},
  })
}
