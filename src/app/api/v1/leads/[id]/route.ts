import { getApiUser } from '@/lib/api/auth'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateLeadSchema } from '@/shared/schemas/business'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  const permissionError = requireDomainPermission(request, role, 'can_manage_leads')
  if (permissionError) return permissionError

  const { id } = await params
  const { data, error: dbError } = await supabase.from('leads').select('*').eq('id', id).eq('org_id', orgId).single()
  if (dbError) {
    log('error', 'leads.getById.failed', { requestId, orgId, userId: user.id, route: '/api/v1/leads/[id]', error: dbError.message, leadId: id })
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: dbError.message }, 404)
  }

  return ok(request, data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  const permissionError = requireDomainPermission(request, role, 'can_manage_leads')
  if (permissionError) return permissionError

  const { id } = await params
  const parsed = updateLeadSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' }, 400)
  }
  const body = parsed.data
  const { data, error: dbError } = await supabase.from('leads').update(body).eq('id', id).eq('org_id', orgId).select().single()
  if (dbError) {
    log('error', 'leads.update.failed', { requestId, orgId, userId: user.id, route: '/api/v1/leads/[id]', error: dbError.message, leadId: id })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  return ok(request, data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  const permissionError = requireDomainPermission(request, role, 'can_manage_leads')
  if (permissionError) return permissionError

  const { id } = await params
  const { error: dbError } = await supabase.from('leads').delete().eq('id', id).eq('org_id', orgId)
  if (dbError) {
    log('error', 'leads.delete.failed', { requestId, orgId, userId: user.id, route: '/api/v1/leads/[id]', error: dbError.message, leadId: id })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  return ok(request, { success: true })
}
