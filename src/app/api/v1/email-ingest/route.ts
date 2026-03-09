import type { SupabaseClient } from '@supabase/supabase-js'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { fail, ok } from '@/lib/api/response'
import { withEmailTriageAuth } from '@/lib/email-triage/api'
import { createEmailTriageItemSchema } from '@/shared/schemas/email-triage'
import type { EmailTriageRecord, EmailTriageSummary } from '@/shared/types/email-triage'

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

function normalizeSearchTerm(value: string | null): string | null {
  const normalized = (value || '').trim().replace(/[%_,]/g, '')
  return normalized.length > 0 ? normalized : null
}

function buildSummary(rows: Array<Pick<EmailTriageRecord, 'classification' | 'status' | 'lead_id'>>): EmailTriageSummary {
  return {
    total: rows.length,
    unreviewed: rows.filter((row) => row.status === 'new' || row.status === 'reviewing').length,
    leadCandidates: rows.filter((row) => row.classification === 'lead').length,
    supplierCandidates: rows.filter((row) => row.classification === 'supplier').length,
    spam: rows.filter((row) => row.classification === 'spam').length,
    linkedLeads: rows.filter((row) => Boolean(row.lead_id)).length,
  }
}

async function hydrateLeadContext(supabase: SupabaseClient, rows: EmailTriageRow[]): Promise<EmailTriageRecord[]> {
  const leadIds = Array.from(new Set(rows.map((row) => row.lead_id).filter(Boolean))) as string[]
  const leadRes = leadIds.length > 0
    ? await supabase.from('leads').select('id, nome').in('id', leadIds)
    : { data: [] as LeadContextRow[], error: null }

  if (leadRes.error) {
    throw new Error(leadRes.error.message)
  }

  const leadNames = new Map(((leadRes.data || []) as LeadContextRow[]).map((lead) => [lead.id, lead.nome || 'Lead']))

  return rows.map((row) => ({
    ...row,
    lead_nome: row.lead_id ? leadNames.get(row.lead_id) || null : null,
  }))
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
  const { searchParams } = new URL(request.url)
  const classification = (searchParams.get('classification') || '').trim()
  const status = (searchParams.get('status') || '').trim()
  const search = normalizeSearchTerm(searchParams.get('q'))
  const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 50,
    maxPageSize: 100,
  })

  let query = supabase
    .from('email_triage_items')
    .select(EMAIL_TRIAGE_COLUMNS, { count: 'exact' })
    .eq('org_id', orgId)

  if (classification) query = query.eq('classification', classification)
  if (status) query = query.eq('status', status)
  if (search) {
    query = query.or(`sender_name.ilike.%${search}%,sender_email.ilike.%${search}%,subject.ilike.%${search}%,snippet.ilike.%${search}%`)
  }

  const { data, count, error } = await query
    .order('received_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    log('error', 'email_triage.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/email-ingest',
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const { data: summaryRows, error: summaryError } = await supabase
    .from('email_triage_items')
    .select('classification, status, lead_id')
    .eq('org_id', orgId)

  if (summaryError) {
    log('error', 'email_triage.summary.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/email-ingest',
      error: summaryError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: summaryError.message }, 500)
  }

  try {
    const normalized = await hydrateLeadContext(supabase, ((data || []) as unknown) as EmailTriageRow[])
    const total = count ?? normalized.length
    return ok(request, normalized, {
      ...buildPaginationMeta(normalized.length, total, page, pageSize),
      summary: buildSummary(((summaryRows || []) as unknown) as Array<Pick<EmailTriageRecord, 'classification' | 'status' | 'lead_id'>>),
    })
  } catch (err) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: err instanceof Error ? err.message : 'Falha ao carregar contexto' },
      500
    )
  }
})

export const POST = withEmailTriageAuth('can_manage_leads', async (request, { supabase, requestId, orgId, user }) => {
  const parsed = createEmailTriageItemSchema.safeParse(await request.json().catch(() => null))
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

  try {
    await ensureLinkedLead(supabase, orgId, parsed.data.lead_id || null)
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? Number((err as { status?: number }).status || 500) : 500
    const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || API_ERROR_CODES.DB_ERROR) : API_ERROR_CODES.DB_ERROR
    return fail(request, { code, message: err instanceof Error ? err.message : 'Falha ao validar lead' }, status)
  }

  const nowIso = new Date().toISOString()
  const reviewedAt = parsed.data.status === 'new' ? null : nowIso
  const { data, error } = await supabase
    .from('email_triage_items')
    .insert({
      org_id: orgId,
      source: parsed.data.source,
      sender_name: parsed.data.sender_name || null,
      sender_email: parsed.data.sender_email,
      subject: parsed.data.subject,
      snippet: parsed.data.snippet || null,
      classification: parsed.data.classification,
      status: parsed.data.status,
      lead_id: parsed.data.lead_id || null,
      received_at: parsed.data.received_at,
      reviewed_at: reviewedAt,
      notes: parsed.data.notes || null,
      created_by: user.id,
      updated_by: user.id,
      updated_at: nowIso,
    })
    .select(EMAIL_TRIAGE_COLUMNS)
    .single()

  if (error) {
    log('error', 'email_triage.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/email-ingest',
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  try {
    const [record] = await hydrateLeadContext(supabase, [((data as unknown) as EmailTriageRow)])
    return ok(request, record, undefined, 201)
  } catch (err) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: err instanceof Error ? err.message : 'Falha ao carregar contexto' },
      500
    )
  }
})
