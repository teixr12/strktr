import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateCompraSchema } from '@/shared/schemas/business'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('compras')
    .select('*, obras(nome)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (dbError) {
    log('error', 'compras.getById.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/compras/[id]',
      compraId: id,
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const parsed = updateCompraSchema.safeParse(await request.json())
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
    .from('compras')
    .update({
      ...body,
      obra_id: body.obra_id === undefined ? undefined : body.obra_id || null,
      fornecedor: body.fornecedor === undefined ? undefined : body.fornecedor || null,
      valor_real: body.valor_real === undefined ? undefined : body.valor_real || null,
      notas: body.notas === undefined ? undefined : body.notas || null,
      data_solicitacao: body.data_solicitacao === undefined ? undefined : body.data_solicitacao || null,
      data_aprovacao: body.data_aprovacao === undefined ? undefined : body.data_aprovacao || null,
      data_pedido: body.data_pedido === undefined ? undefined : body.data_pedido || null,
      data_entrega: body.data_entrega === undefined ? undefined : body.data_entrega || null,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*, obras(nome)')
    .single()

  if (dbError) {
    log('error', 'compras.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/compras/[id]',
      compraId: id,
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const { id } = await params
  const { error: dbError } = await supabase
    .from('compras')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbError) {
    log('error', 'compras.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/compras/[id]',
      compraId: id,
      error: dbError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  return ok(request, { success: true })
}
