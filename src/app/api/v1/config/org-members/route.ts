import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { createOrgMemberSchema } from '@/shared/schemas/business'

export async function POST(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const parsed = createOrgMemberSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }

  const email = parsed.data.email.trim().toLowerCase()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, nome, email, org_id')
    .eq('email', email)
    .maybeSingle()

  if (profileError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: profileError.message }, 400)
  }
  if (!profile) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Usuário não encontrado. Ele precisa se registrar primeiro.' }, 404)
  }

  const { data: existingMember } = await supabase
    .from('org_membros')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (existingMember?.status === 'ativo') {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Este usuário já faz parte da organização' },
      409
    )
  }

  let memberId = existingMember?.id ?? null
  if (existingMember) {
    const { error: reactivationError } = await supabase
      .from('org_membros')
      .update({
        role: parsed.data.role,
        status: 'ativo',
        convidado_por: user.id,
      })
      .eq('id', existingMember.id)
      .eq('org_id', orgId)

    if (reactivationError) {
      return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: reactivationError.message }, 400)
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('org_membros')
      .insert({
        org_id: orgId,
        user_id: profile.id,
        role: parsed.data.role,
        status: 'ativo',
        convidado_por: user.id,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      log('error', 'config.org_members.create.failed', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/config/org-members',
        error: insertError?.message || 'unknown',
      })
      return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: insertError?.message || 'Erro ao convidar membro' }, 400)
    }
    memberId = inserted.id
  }

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({ org_id: orgId })
    .eq('id', profile.id)

  if (profileUpdateError) {
    log('warn', 'config.org_members.profile_update_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/config/org-members',
      invitedUserId: profile.id,
      error: profileUpdateError.message,
    })
  }

  const { data: member, error: memberError } = await supabase
    .from('org_membros')
    .select('*')
    .eq('id', memberId)
    .eq('org_id', orgId)
    .single()

  if (memberError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: memberError.message }, 400)
  }

  return ok(
    request,
    {
      ...member,
      profiles: {
        nome: profile.nome || 'Usuário',
        email: profile.email || null,
      },
    },
    undefined,
    existingMember ? 200 : 201
  )
}
