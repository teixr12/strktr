import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { emitProductEvent } from '@/lib/telemetry'
import { requireExecutionPermission } from '@/lib/auth/execution-permissions'

export async function POST(
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
  const permissionError = requireExecutionPermission(request, role, 'can_toggle_checklist')
  if (permissionError) return permissionError

  const { id, itemId } = await params

  const { data: item, error: fetchError } = await supabase
    .from('checklist_items')
    .select('id, concluido, checklist_id, org_id')
    .eq('id', itemId)
    .eq('org_id', orgId)
    .single()

  if (fetchError || !item) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Item de checklist não encontrado' }, 404)
  }

  const { data: checklist } = await supabase
    .from('obra_checklists')
    .select('id, obra_id, nome')
    .eq('id', item.checklist_id)
    .eq('obra_id', id)
    .eq('org_id', orgId)
    .single()

  if (!checklist) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Checklist não encontrado para a obra' }, 404)
  }

  const nextDone = !item.concluido
  const { data, error: updateError } = await supabase
    .from('checklist_items')
    .update({
      concluido: nextDone,
      concluido_por: nextDone ? user.id : null,
      concluido_em: nextDone ? new Date().toISOString() : null,
    })
    .eq('id', itemId)
    .select('*')
    .single()

  if (updateError) {
    log('error', 'obras.checklist.toggle.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/checklists/items/[itemId]/toggle',
      obraId: id,
      itemId,
      error: updateError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: updateError.message }, 500)
  }

  await supabase.from('diario_obra').insert({
    obra_id: id,
    user_id: user.id,
    org_id: orgId,
    tipo: 'checklist',
    titulo: `Checklist atualizado: ${checklist.nome}`,
    descricao: nextDone ? 'Item concluído' : 'Item reaberto',
    metadata: { checklistId: checklist.id, itemId, concluido: nextDone },
  })

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'ChecklistItemToggled',
    entityType: 'checklist_item',
    entityId: itemId,
    payload: { obraId: id, checklistId: checklist.id, concluido: nextDone },
  }).catch(() => undefined)

  return ok(request, data)
}
