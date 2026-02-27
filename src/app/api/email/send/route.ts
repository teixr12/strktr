import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { fail, ok } from '@/lib/api/response'
import { sendNotificationEmail } from '@/lib/email/resend'

type SendEmailPayload = {
  to?: string
  subject?: string
  titulo?: string
  descricao?: string
  link?: string
}

export async function POST(request: Request) {
  const { user, supabase, error, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const body = (await request.json().catch(() => null)) as SendEmailPayload | null
  if (!body?.to || !body.subject || !body.titulo) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Campos obrigatórios: to, subject, titulo',
      },
      400
    )
  }

  const result = await sendNotificationEmail(
    body.to,
    body.subject,
    body.titulo,
    body.descricao || '',
    body.link
  )

  if (!result) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.DB_ERROR,
        message: 'Resend API key não configurada ou erro no envio',
      },
      503
    )
  }

  return ok(request, { success: true, id: result.id })
}
