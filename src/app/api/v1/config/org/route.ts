import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { createOrgSchema, updateOrgSchema } from '@/shared/schemas/business'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { user, error, requestId } = await getApiUser(request)
  if (!user) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }

  const parsed = createOrgSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }

  const payload = parsed.data
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' },
      500
    )
  }
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )

  const { data: organizacao, error: orgError } = await adminSupabase
    .from('organizacoes')
    .insert({
      nome: payload.nome,
      cnpj: payload.cnpj || null,
    })
    .select()
    .single()

  if (orgError || !organizacao) {
    log('error', 'config.org.create.failed', {
      requestId,
      userId: user.id,
      route: '/api/v1/config/org',
      error: orgError?.message || 'unknown',
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: orgError?.message || 'Erro ao criar organização' },
      400
    )
  }

  const { data: membership, error: membershipError } = await adminSupabase
    .from('org_membros')
    .insert({
      org_id: organizacao.id,
      user_id: user.id,
      role: 'admin',
      status: 'ativo',
    })
    .select('*')
    .single()

  if (membershipError) {
    log('error', 'config.org.create.membership_failed', {
      requestId,
      userId: user.id,
      route: '/api/v1/config/org',
      orgId: organizacao.id,
      error: membershipError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: membershipError.message }, 400)
  }

  const { error: profileError } = await adminSupabase
    .from('profiles')
    .update({ org_id: organizacao.id })
    .eq('id', user.id)

  if (profileError) {
    log('warn', 'config.org.create.profile_update_failed', {
      requestId,
      userId: user.id,
      route: '/api/v1/config/org',
      orgId: organizacao.id,
      error: profileError.message,
    })
  }

  return ok(request, { organizacao, membership }, undefined, 201)
}

export async function PATCH(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const parsed = updateOrgSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }

  const { data, error: dbError } = await supabase
    .from('organizacoes')
    .update(parsed.data)
    .eq('id', orgId)
    .select()
    .single()

  if (dbError) {
    log('error', 'config.org.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/config/org',
      error: dbError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  return ok(request, data)
}
