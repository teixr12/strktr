import { getApiUser } from '@/lib/api/auth'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { createProjetoSchema } from '@/shared/schemas/business'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 50,
    maxPageSize: 100,
  })

  // Single query: fetch data + count in one round-trip (eliminates duplicate DB call)
  let query = supabase
    .from('projetos')
    .select('*, leads(nome), obras(nome)', { count: 'exact' })
    .eq('org_id', orgId)
  if (status) query = query.eq('status', status)
  query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)

  const { data, count, error: dbError } = await query
  if (dbError) {
    log('error', 'projetos.get.failed', { requestId, orgId, userId: user.id, route: '/api/v1/projetos', error: dbError.message })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  const total = count ?? data?.length ?? 0

  return ok(request, data ?? [], buildPaginationMeta(data?.length || 0, total, page, pageSize))
}

export async function POST(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const parsed = createProjetoSchema.safeParse(await request.json())
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
    .from('projetos')
    .insert({
      ...body,
      user_id: user.id,
      org_id: orgId,
      descricao: body.descricao || null,
      cliente: body.cliente || null,
      local: body.local || null,
      area_m2: body.area_m2 || null,
      lead_id: body.lead_id || null,
      obra_id: body.obra_id || null,
      data_inicio_prev: body.data_inicio_prev || null,
      data_fim_prev: body.data_fim_prev || null,
      notas: body.notas || null,
    })
    .select()
    .single()

  if (dbError) {
    log('error', 'projetos.create.failed', { requestId, orgId, userId: user.id, route: '/api/v1/projetos', error: dbError.message })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }
  return ok(request, data, undefined, 201)
}
