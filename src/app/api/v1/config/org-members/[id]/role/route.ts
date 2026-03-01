import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateOrgMemberRoleSchema } from '@/shared/schemas/business'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const parsed = updateOrgMemberRoleSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }

  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('org_membros')
    .update({ role: parsed.data.role })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (dbError) {
    log('error', 'config.org_members.role_update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/config/org-members/[id]/role',
      memberId: id,
      error: dbError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, email')
    .eq('id', data.user_id)
    .maybeSingle()

  return ok(request, {
    ...data,
    profiles: profile || null,
  })
}
