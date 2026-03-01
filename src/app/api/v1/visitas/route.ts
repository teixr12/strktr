import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { createVisitaSchema } from '@/shared/schemas/business'

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const obraId = searchParams.get('obra_id')
  const leadId = searchParams.get('lead_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 300)

  let query = supabase
    .from('visitas')
    .select('*, obras(nome), leads(nome)')
    .eq('org_id', orgId)
    .order('data_hora', { ascending: true })
    .limit(limit)
  if (status) query = query.eq('status', status)
  if (obraId) query = query.eq('obra_id', obraId)
  if (leadId) query = query.eq('lead_id', leadId)

  const { data, error: dbError } = await query
  if (dbError) {
    log('error', 'visitas.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/visitas',
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      500
    )
  }

  return ok(request, data ?? [], { count: data?.length || 0 })
}

export async function POST(request: Request) {
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

  const parsed = createVisitaSchema.safeParse(await request.json())
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
    .from('visitas')
    .insert({
      user_id: user.id,
      org_id: orgId,
      obra_id: body.obra_id || null,
      lead_id: body.lead_id || null,
      titulo: body.titulo,
      descricao: body.descricao || null,
      tipo: body.tipo,
      data_hora: body.data_hora,
      duracao_min: body.duracao_min,
      local: body.local || null,
      status: body.status,
      participantes: body.participantes || null,
      notas: body.notas || null,
    })
    .select('*, obras(nome), leads(nome)')
    .single()

  if (dbError) {
    log('error', 'visitas.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/visitas',
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      500
    )
  }

  return ok(request, data, undefined, 201)
}
