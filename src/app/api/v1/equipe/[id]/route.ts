import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateMembroSchema } from '@/shared/schemas/business'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('equipe')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (dbError) {
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: dbError.message },
      404
    )
  }
  return ok(request, data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const parsed = updateMembroSchema.safeParse(await request.json())
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
  const body = parsed.data
  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('equipe')
    .update({
      nome: body.nome,
      cargo: body.cargo,
      telefone: body.telefone === undefined ? undefined : body.telefone || null,
      email: body.email === undefined ? undefined : body.email || null,
      especialidade:
        body.especialidade === undefined ? undefined : body.especialidade || null,
      status: body.status,
      avaliacao: body.avaliacao,
      valor_hora: body.valor_hora === undefined ? undefined : body.valor_hora || null,
      notas: body.notas === undefined ? undefined : body.notas || null,
      avatar_url: body.avatar_url === undefined ? undefined : body.avatar_url || null,
      obras_ids: body.obras_ids,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (dbError) {
    log('error', 'equipe.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/equipe/[id]',
      memberId: id,
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      400
    )
  }

  return ok(request, data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const { id } = await params
  const { error: dbError } = await supabase
    .from('equipe')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbError) {
    log('error', 'equipe.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/equipe/[id]',
      memberId: id,
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      400
    )
  }

  return ok(request, { success: true })
}
