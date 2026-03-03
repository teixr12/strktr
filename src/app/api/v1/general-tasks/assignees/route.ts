import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import type { GeneralTaskAssignee } from '@/shared/types/general-tasks'

export async function GET(request: Request) {
  const { user, supabase, error, orgId } = await getApiUser(request)
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

  const { data: members, error: membersError } = await supabase
    .from('org_membros')
    .select('user_id, role')
    .eq('org_id', orgId)
    .eq('status', 'ativo')
    .limit(200)

  if (membersError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: membersError.message }, 500)
  }

  const userIds = Array.from(new Set((members || []).map((member) => member.user_id).filter(Boolean)))
  if (userIds.length === 0) {
    return ok(request, [] as GeneralTaskAssignee[])
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, nome, email')
    .in('id', userIds)

  if (profilesError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: profilesError.message }, 500)
  }

  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]))
  const assignees: GeneralTaskAssignee[] = userIds
    .map((userId) => {
      const member = members?.find((item) => item.user_id === userId)
      const profile = profileById.get(userId)
      return {
        user_id: userId,
        nome: profile?.nome || 'Membro',
        email: profile?.email || null,
        role: member?.role || 'user',
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return ok(request, assignees, { count: assignees.length })
}
