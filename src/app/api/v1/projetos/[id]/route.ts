import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateProjetoSchema } from '@/shared/schemas/business'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('projetos')
    .select('*, leads(nome), obras(nome)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (dbError) {
    log('error', 'projetos.getById.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/projetos/[id]',
      projetoId: id,
      error: dbError.message,
    })
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: dbError.message }, 404)
  }

  return ok(request, data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const parsed = updateProjetoSchema.safeParse(await request.json())
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

  const body = parsed.data
  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('projetos')
    .update({
      ...body,
      descricao: body.descricao === undefined ? undefined : body.descricao || null,
      cliente: body.cliente === undefined ? undefined : body.cliente || null,
      local: body.local === undefined ? undefined : body.local || null,
      area_m2: body.area_m2 === undefined ? undefined : body.area_m2 || null,
      lead_id: body.lead_id === undefined ? undefined : body.lead_id || null,
      obra_id: body.obra_id === undefined ? undefined : body.obra_id || null,
      data_inicio_prev: body.data_inicio_prev === undefined ? undefined : body.data_inicio_prev || null,
      data_fim_prev: body.data_fim_prev === undefined ? undefined : body.data_fim_prev || null,
      notas: body.notas === undefined ? undefined : body.notas || null,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*, leads(nome), obras(nome)')
    .single()

  if (dbError) {
    log('error', 'projetos.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/projetos/[id]',
      projetoId: id,
      error: dbError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  return ok(request, data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const { id } = await params
  const { error: dbError } = await supabase
    .from('projetos')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbError) {
    log('error', 'projetos.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/projetos/[id]',
      projetoId: id,
      error: dbError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  return ok(request, { success: true })
}
