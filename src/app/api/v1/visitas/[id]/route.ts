import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateVisitaSchema } from '@/shared/schemas/business'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }
  if (!orgId) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' },
      403
    )
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_leads')
  if (permissionError) return permissionError

  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('visitas')
    .select('*, obras(nome), leads(nome)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (dbError) {
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: dbError.message },
      404
    )
  }

  return ok(request, data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }
  if (!orgId) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' },
      403
    )
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_leads')
  if (permissionError) return permissionError

  const parsed = updateVisitaSchema.safeParse(await request.json())
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
    .from('visitas')
    .update({
      obra_id: body.obra_id === undefined ? undefined : body.obra_id || null,
      lead_id: body.lead_id === undefined ? undefined : body.lead_id || null,
      titulo: body.titulo,
      descricao: body.descricao === undefined ? undefined : body.descricao || null,
      tipo: body.tipo,
      data_hora: body.data_hora,
      duracao_min: body.duracao_min,
      local: body.local === undefined ? undefined : body.local || null,
      status: body.status,
      participantes: body.participantes === undefined ? undefined : body.participantes || null,
      notas: body.notas === undefined ? undefined : body.notas || null,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*, obras(nome), leads(nome)')
    .single()

  if (dbError) {
    log('error', 'visitas.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/visitas/[id]',
      visitaId: id,
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      400
    )
  }

  return ok(request, data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }
  if (!orgId) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' },
      403
    )
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_leads')
  if (permissionError) return permissionError

  const { id } = await params
  const { error: dbError } = await supabase
    .from('visitas')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbError) {
    log('error', 'visitas.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/visitas/[id]',
      visitaId: id,
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      400
    )
  }

  return ok(request, { success: true })
}
