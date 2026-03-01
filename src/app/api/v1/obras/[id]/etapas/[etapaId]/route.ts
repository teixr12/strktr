import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { canManageExecutionStructure, requireExecutionPermission } from '@/lib/auth/execution-permissions'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; etapaId: string }> }
) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireExecutionPermission(request, role, 'can_update_stage')
  if (permissionError) return permissionError
  if (!canManageExecutionStructure(role)) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Somente admin/manager podem editar etapas' },
      403
    )
  }

  const { id, etapaId } = await params
  const body = await request.json()
  const payload = {
    nome: body?.nome ? String(body.nome).trim() : undefined,
    responsavel: body?.responsavel ? String(body.responsavel).trim() : null,
    descricao: body?.descricao ? String(body.descricao).trim() : null,
  }

  if (!payload.nome) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Nome é obrigatório' }, 400)
  }

  const { data, error: dbError } = await supabase
    .from('obra_etapas')
    .update(payload)
    .eq('id', etapaId)
    .eq('obra_id', id)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (dbError || !data) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError?.message || 'Erro ao atualizar etapa' }, 500)
  }

  return ok(request, data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; etapaId: string }> }
) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireExecutionPermission(request, role, 'can_update_stage')
  if (permissionError) return permissionError
  if (!canManageExecutionStructure(role)) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Somente admin/manager podem excluir etapas' },
      403
    )
  }

  const { id, etapaId } = await params
  const { data: etapa } = await supabase
    .from('obra_etapas')
    .select('id, nome')
    .eq('id', etapaId)
    .eq('obra_id', id)
    .eq('org_id', orgId)
    .single()

  if (!etapa) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Etapa não encontrada' }, 404)
  }

  const { error: dbError } = await supabase
    .from('obra_etapas')
    .delete()
    .eq('id', etapaId)
    .eq('obra_id', id)
    .eq('org_id', orgId)

  if (dbError) {
    log('error', 'obras.etapas.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/etapas/[etapaId]',
      obraId: id,
      etapaId,
      error: dbError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  await supabase.from('diario_obra').insert({
    obra_id: id,
    user_id: user.id,
    org_id: orgId,
    tipo: 'etapa_change',
    titulo: 'Etapa removida',
    descricao: etapa.nome,
    metadata: { etapaId },
  })

  return ok(request, { deleted: true })
}
