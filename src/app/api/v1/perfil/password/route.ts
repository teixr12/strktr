import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { updatePasswordSchema } from '@/shared/schemas/business'

export async function POST(request: Request) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }

  const parsed = updatePasswordSchema.safeParse(await request.json())
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

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })
  if (updateError) {
    log('error', 'perfil.password.update_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/perfil/password',
      error: updateError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: updateError.message },
      500
    )
  }

  return ok(request, { success: true })
}
