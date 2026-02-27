import { getApiUser } from '@/lib/api/auth'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { emitProductEvent } from '@/lib/telemetry'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { createLeadSchema } from '@/shared/schemas/business'
import { runAutomation } from '@/server/services/automation/automation-service'

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  const permissionError = requireDomainPermission(request, role, 'can_manage_leads')
  if (permissionError) return permissionError

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  let query = supabase.from('leads').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(limit)
  if (status) query = query.eq('status', status)

  const { data, error: dbError } = await query
  if (dbError) {
    log('error', 'leads.get.failed', { requestId, orgId, userId: user.id, route: '/api/v1/leads', error: dbError.message })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  return ok(request, data ?? [], { count: data?.length || 0 })
}

export async function POST(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  const permissionError = requireDomainPermission(request, role, 'can_manage_leads')
  if (permissionError) return permissionError

  const parsed = createLeadSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }
  const body = parsed.data

  const { data, error: dbError } = await supabase
    .from('leads')
    .insert({ ...body, user_id: user.id, org_id: orgId })
    .select()
    .single()

  if (dbError) {
    log('error', 'leads.create.failed', { requestId, orgId, userId: user.id, route: '/api/v1/leads', error: dbError.message })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }
  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'LeadCreated',
    entityType: 'lead',
    entityId: data.id,
    payload: { status: data.status, origem: data.origem },
  }).catch(() => undefined)

  if (process.env.NEXT_PUBLIC_FF_SEMI_AUTOMATION === 'true') {
    await runAutomation(
      supabase,
      {
        orgId,
        userId: user.id,
        trigger: 'LeadCreated',
        triggerEntityType: 'lead',
        triggerEntityId: data.id,
        payload: { status: data.status, origem: data.origem },
      },
      {
        confirm: true,
        source: 'trigger',
      }
    ).catch(() => undefined)
  }

  return ok(request, data, undefined, 201)
}
