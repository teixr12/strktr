import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { createMembroSchema } from '@/shared/schemas/business'

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
  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200)

  let query = supabase
    .from('equipe')
    .select('*')
    .eq('org_id', orgId)
    .order('nome')
    .limit(limit)
  if (status) query = query.eq('status', status)

  const { data, error: dbError } = await query
  if (dbError) {
    log('error', 'equipe.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/equipe',
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const parsed = createMembroSchema.safeParse(await request.json())
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
    .from('equipe')
    .insert({
      user_id: user.id,
      org_id: orgId,
      nome: body.nome,
      cargo: body.cargo,
      telefone: body.telefone || null,
      email: body.email || null,
      especialidade: body.especialidade || null,
      status: body.status,
      avaliacao: body.avaliacao,
      valor_hora: body.valor_hora || null,
      notas: body.notas || null,
      avatar_url: body.avatar_url || null,
      obras_ids: body.obras_ids || [],
    })
    .select()
    .single()

  if (dbError) {
    log('error', 'equipe.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/equipe',
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      400
    )
  }

  return ok(request, data, undefined, 201)
}
