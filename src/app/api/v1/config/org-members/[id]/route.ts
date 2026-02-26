import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const { id } = await params
  const { data: targetMember, error: memberError } = await supabase
    .from('org_membros')
    .select('id, user_id, role, org_id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (memberError || !targetMember) {
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: memberError?.message || 'Membro não encontrado' },
      404
    )
  }

  if (targetMember.user_id === user.id) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Você não pode se remover da organização' },
      403
    )
  }

  const { error: deleteError } = await supabase
    .from('org_membros')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (deleteError) {
    log('error', 'config.org_members.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/config/org-members/[id]',
      memberId: id,
      error: deleteError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: deleteError.message }, 400)
  }

  const { data: remainingMemberships } = await supabase
    .from('org_membros')
    .select('org_id')
    .eq('user_id', targetMember.user_id)
    .eq('status', 'ativo')
    .order('created_at', { ascending: true })

  const nextOrgId = remainingMemberships?.[0]?.org_id ?? null
  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({ org_id: nextOrgId })
    .eq('id', targetMember.user_id)

  if (profileUpdateError) {
    log('warn', 'config.org_members.delete.profile_update_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/config/org-members/[id]',
      removedUserId: targetMember.user_id,
      error: profileUpdateError.message,
    })
  }

  return ok(request, { success: true, removedUserId: targetMember.user_id, nextOrgId })
}
