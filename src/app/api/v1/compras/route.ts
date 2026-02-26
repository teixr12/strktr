import { getApiUser } from '@/lib/api/auth'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { createCompraSchema } from '@/shared/schemas/business'

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const obra_id = searchParams.get('obra_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  let query = supabase.from('compras').select('*, obras(nome)').eq('org_id', orgId).order('created_at', { ascending: false }).limit(limit)
  if (status) query = query.eq('status', status)
  if (obra_id) query = query.eq('obra_id', obra_id)

  const { data, error: dbError } = await query
  if (dbError) {
    log('error', 'compras.get.failed', { requestId, orgId, userId: user.id, route: '/api/v1/compras', error: dbError.message })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  return ok(request, data ?? [], { count: data?.length || 0 })
}

export async function POST(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const parsed = createCompraSchema.safeParse(await request.json())
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
  const { data, error: dbError } = await supabase
    .from('compras')
    .insert({
      ...body,
      user_id: user.id,
      org_id: orgId,
      obra_id: body.obra_id || null,
      fornecedor: body.fornecedor || null,
      valor_real: body.valor_real || null,
      notas: body.notas || null,
      data_solicitacao: body.data_solicitacao || new Date().toISOString().slice(0, 10),
      data_aprovacao: body.data_aprovacao || null,
      data_pedido: body.data_pedido || null,
      data_entrega: body.data_entrega || null,
    })
    .select()
    .single()

  if (dbError) {
    log('error', 'compras.create.failed', { requestId, orgId, userId: user.id, route: '/api/v1/compras', error: dbError.message })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }
  return ok(request, data, undefined, 201)
}
