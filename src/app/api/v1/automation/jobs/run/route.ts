import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { runAutomationJobSchema } from '@/shared/schemas/roadmap-automation'
import { runAutomation } from '@/server/services/automation/automation-service'

export async function POST(request: Request) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const parsed = runAutomationJobSchema.safeParse(await request.json().catch(() => null))
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

  const result = await runAutomation(
    supabase,
    {
      orgId,
      userId: user.id,
      trigger: parsed.data.trigger,
      triggerEntityType: parsed.data.triggerEntityType,
      triggerEntityId: parsed.data.triggerEntityId,
      payload: parsed.data.payload,
    },
    {
      confirm: parsed.data.confirm,
      source: 'manual',
    }
  )

  const statusCode = result.status === 'pending_review' ? 409 : result.status === 'error' ? 500 : 200

  return ok(request, result, { flag: 'NEXT_PUBLIC_FF_SEMI_AUTOMATION' }, statusCode)
}
