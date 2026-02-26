import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { canManageExecutionStructure, requireExecutionPermission } from '@/lib/auth/execution-permissions'
import { createChecklistSchema } from '@/shared/schemas/execution'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; checklistId: string }> }
) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireExecutionPermission(request, role, 'can_toggle_checklist')
  if (permissionError) return permissionError
  if (!canManageExecutionStructure(role)) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Somente admin/manager podem editar checklists' },
      403
    )
  }

  const { id, checklistId } = await params
  const parsed = createChecklistSchema.pick({ nome: true }).safeParse(await request.json())
  if (!parsed.success) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' }, 400)
  }
  const payload = parsed.data

  const { data, error: dbError } = await supabase
    .from('obra_checklists')
    .update({ nome: payload.nome })
    .eq('id', checklistId)
    .eq('obra_id', id)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (dbError || !data) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError?.message || 'Erro ao atualizar checklist' }, 400)
  }
  return ok(request, data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; checklistId: string }> }
) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireExecutionPermission(request, role, 'can_toggle_checklist')
  if (permissionError) return permissionError
  if (!canManageExecutionStructure(role)) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Somente admin/manager podem excluir checklists' },
      403
    )
  }
  const { id, checklistId } = await params

  const { data: checklist } = await supabase
    .from('obra_checklists')
    .select('id, nome')
    .eq('id', checklistId)
    .eq('obra_id', id)
    .eq('org_id', orgId)
    .single()

  if (!checklist) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Checklist não encontrado' }, 404)
  }

  const { error: dbError } = await supabase
    .from('obra_checklists')
    .delete()
    .eq('id', checklistId)
    .eq('obra_id', id)
    .eq('org_id', orgId)

  if (dbError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  await supabase.from('diario_obra').insert({
    obra_id: id,
    user_id: user.id,
    org_id: orgId,
    tipo: 'checklist',
    titulo: 'Checklist removido',
    descricao: checklist.nome,
    metadata: { checklistId },
  })

  return ok(request, { deleted: true })
}
