import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { updateProfileSchema } from '@/shared/schemas/business'

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }

  const { data, error: dbError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (dbError) {
    log('error', 'perfil.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/perfil',
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      500
    )
  }

  return ok(request, data)
}

export async function PATCH(request: Request) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }

  const parsed = updateProfileSchema.safeParse(await request.json())
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

  const payload = parsed.data
  const { data, error: dbError } = await supabase
    .from('profiles')
    .update({
      nome: payload.nome,
      telefone: payload.telefone === undefined ? undefined : payload.telefone || null,
      empresa: payload.empresa === undefined ? undefined : payload.empresa || null,
      cargo: payload.cargo === undefined ? undefined : payload.cargo || null,
      avatar_url: payload.avatar_url === undefined ? undefined : payload.avatar_url || null,
    })
    .eq('id', user.id)
    .select('*')
    .single()

  if (dbError) {
    log('error', 'perfil.patch.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/perfil',
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      500
    )
  }

  return ok(request, data)
}
