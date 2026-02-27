import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { listAutomationTemplates } from '@/server/services/automation/automation-service'

export async function GET(request: Request) {
  const { user, supabase, error, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  return ok(request, { templates: listAutomationTemplates() }, { flag: 'NEXT_PUBLIC_FF_SEMI_AUTOMATION' })
}
