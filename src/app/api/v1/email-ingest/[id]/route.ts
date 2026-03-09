import type { SupabaseClient } from '@supabase/supabase-js'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { withEmailTriageAuth } from '@/lib/email-triage/api'
import { updateEmailTriageItemSchema } from '@/shared/schemas/email-triage'
import type { EmailTriageRecord } from '@/shared/types/email-triage'

const EMAIL_TRIAGE_COLUMNS = [
  'id',
  'org_id',
  'source',
  'sender_name',
  'sender_email',
  'subject',
  'snippet',
  'classification',
  'status',
  'lead_id',
  'received_at',
  'reviewed_at',
  'notes',
  'created_at',
  'updated_at',
].join(', ')

type EmailTriageRow = Omit<EmailTriageRecord, 'lead_nome'>
type LeadContextRow = { id: string; nome: string | null }

async function hydrateLeadContext(supabase: SupabaseClient, row: EmailTriageRow): Promise<EmailTriageRecord> {
  const leadRes = row.lead_id
    ? await supabase.from('leads').select('id, nome').eq('id', row.lead_id).maybeSingle()
    : { data: null as LeadContextRow | null, error: null }

  if (leadRes.error) {
    throw new Error(leadRes.error.message)
  }

  return {
    ...row,
    lead_nome: leadRes.data?.nome || null,
  }
}

async function ensureLinkedLead(supabase: SupabaseClient, orgId: string, leadId: string | null | undefined) {
  if (!leadId) return
  const { data, error } = await supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    const err = new Error('Lead vinculado não encontrado') as Error & { code?: string; status?: number }
    err.code = API_ERROR_CODES.NOT_FOUND
    err.status = 404
    throw err
  }
}

export const GET = withEmailTriageAuth('can_manage_leads', async (request, { supabase, requestId, orgId, user }) => {
  const id = new URL(request.url).pathname.split('/').pop() || ''
  const { data, error } = await supabase
    .from('email_triage_items')
    .select(EMAIL_TRIAGE_COLUMNS)
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    log('error', 'email_triage.get_by_id.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/email-ingest/[id]',
      itemId: id,
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  if (!data) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Item não encontrado' }, 404)
  }

  try {
    const hydrated = await hydrateLeadContext(supabase, (data as unknown) as EmailTriageRow)
    return ok(request, hydrated)
  } catch (err) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: err instanceof Error ? err.message : 'Falha ao carregar contexto' },
      500
    )
  }
})

export const PUT = withEmailTriageAuth('can_manage_leads', async (request, { supabase, requestId, orgId, user }) => {
  const id = new URL(request.url).pathname.split('/').pop() || ''
  const parsed = updateEmailTriageItemSchema.safeParse(await request.json().catch(() => null))

  if (!parsed.success) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message || 'Payload inválido',
      },
      400
    )
  }

  const { data: existing, error: existingError } = await supabase
    .from('email_triage_items')
    .select('id, lead_id')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (existingError) {
    log('error', 'email_triage.lookup.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/email-ingest/[id]',
      itemId: id,
      error: existingError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingError.message }, 500)
  }

  if (!existing) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Item não encontrado' }, 404)
  }

  const nextLeadId = parsed.data.lead_id !== undefined ? parsed.data.lead_id || null : existing.lead_id

  try {
    await ensureLinkedLead(supabase, orgId, nextLeadId)
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? Number((err as { status?: number }).status || 500) : 500
    const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || API_ERROR_CODES.DB_ERROR) : API_ERROR_CODES.DB_ERROR
    return fail(request, { code, message: err instanceof Error ? err.message : 'Falha ao validar lead' }, status)
  }

  const nowIso = new Date().toISOString()
  const updates: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: nowIso,
  }

  const keys: Array<keyof typeof parsed.data> = [
    'source',
    'sender_name',
    'sender_email',
    'subject',
    'snippet',
    'classification',
    'status',
    'lead_id',
    'received_at',
    'notes',
  ]

  for (const key of keys) {
    if (parsed.data[key] !== undefined) {
      updates[key] = parsed.data[key] || null
    }
  }

  if (parsed.data.status !== undefined) {
    updates.reviewed_at = parsed.data.status === 'new' ? null : nowIso
  }

  const { data, error } = await supabase
    .from('email_triage_items')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select(EMAIL_TRIAGE_COLUMNS)
    .single()

  if (error) {
    log('error', 'email_triage.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/email-ingest/[id]',
      itemId: id,
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  try {
    const hydrated = await hydrateLeadContext(supabase, (data as unknown) as EmailTriageRow)
    return ok(request, hydrated)
  } catch (err) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: err instanceof Error ? err.message : 'Falha ao carregar contexto' },
      500
    )
  }
})

export const DELETE = withEmailTriageAuth('can_manage_leads', async (request, { supabase, requestId, orgId, user }) => {
  const id = new URL(request.url).pathname.split('/').pop() || ''
  const { error } = await supabase
    .from('email_triage_items')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) {
    log('error', 'email_triage.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/email-ingest/[id]',
      itemId: id,
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, { success: true })
})
