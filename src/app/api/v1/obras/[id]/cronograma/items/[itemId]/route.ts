import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateCronogramaItemSchema } from '@/shared/schemas/cronograma-portal'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const payload = await request.json().catch(() => null)
  const predecessorItemIds: string[] | undefined = Array.isArray(payload?.predecessor_item_ids)
    ? payload.predecessor_item_ids.filter((value: unknown): value is string => typeof value === 'string')
    : undefined
  const parsed = updateCronogramaItemSchema.safeParse(payload)
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }

  const { id: obraId, itemId } = await params
  const body = parsed.data
  const { data: existing, error: existingError } = await supabase
    .from('cronograma_itens')
    .select('id, cronograma_id, org_id')
    .eq('id', itemId)
    .eq('obra_id', obraId)
    .eq('org_id', orgId)
    .single()

  if (existingError || !existing) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Item do cronograma não encontrado' }, 404)
  }

  const { data: updated, error: updateError } = await supabase
    .from('cronograma_itens')
    .update({
      nome: body.nome,
      descricao: body.descricao === undefined ? undefined : body.descricao || null,
      tipo: body.tipo,
      status: body.status,
      empresa_responsavel: body.empresa_responsavel === undefined ? undefined : body.empresa_responsavel || null,
      responsavel: body.responsavel === undefined ? undefined : body.responsavel || null,
      data_inicio_planejada: body.data_inicio_planejada === undefined ? undefined : body.data_inicio_planejada || null,
      data_fim_planejada: body.data_fim_planejada === undefined ? undefined : body.data_fim_planejada || null,
      duracao_dias: body.duracao_dias,
      progresso: body.progresso,
      ordem: body.ordem,
      metadata: body.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (updateError || !updated) {
    log('error', 'cronograma.items.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/cronograma/items/[itemId]',
      obraId,
      itemId,
      error: updateError?.message || 'unknown',
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: updateError?.message || 'Erro ao atualizar item' }, 400)
  }

  if (predecessorItemIds) {
    const { error: deleteDepsError } = await supabase
      .from('cronograma_dependencias')
      .delete()
      .eq('successor_item_id', itemId)
      .eq('org_id', orgId)

    if (deleteDepsError) {
      return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: deleteDepsError.message }, 400)
    }

    if (predecessorItemIds.length > 0) {
      const depsPayload = predecessorItemIds
        .filter((predId: string) => predId !== itemId)
        .map((predId: string) => ({
          cronograma_id: existing.cronograma_id,
          org_id: orgId,
          predecessor_item_id: predId,
          successor_item_id: itemId,
          tipo: 'FS',
          lag_dias: 0,
        }))

      if (depsPayload.length > 0) {
        const { error: insertDepsError } = await supabase
          .from('cronograma_dependencias')
          .insert(depsPayload)
        if (insertDepsError) {
          return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: insertDepsError.message }, 400)
        }
      }
    }
  }

  return ok(request, updated)
}
