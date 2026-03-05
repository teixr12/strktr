import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { requireExecutionPermission } from '@/lib/auth/execution-permissions'
import { CHECKLIST_ITEM_SELECT, CHECKLIST_ITEM_SELECT_WITH_DUE_DATE } from '@/lib/api/select-maps'
import { updateChecklistItemSchema } from '@/shared/schemas/execution'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; checklistId: string; itemId: string }> }
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
  const { id, checklistId, itemId } = await params
  const parsed = updateChecklistItemSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' }, 400)
  }
  const body = parsed.data

  const { data: checklist } = await supabase
    .from('obra_checklists')
    .select('id')
    .eq('id', checklistId)
    .eq('obra_id', id)
    .eq('org_id', orgId)
    .single()

  if (!checklist) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Checklist não encontrado' }, 404)
  }

  const payload: Record<string, unknown> = {}
  if (typeof body?.descricao === 'string') payload.descricao = body.descricao.trim()
  const dueDateEnabled = isFeatureEnabled('checklistDueDate')
  if (dueDateEnabled && (body?.data_limite === null || typeof body?.data_limite === 'string')) {
    payload.data_limite = body.data_limite
  }

  if (Object.keys(payload).length === 0) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Payload vazio' }, 400)
  }

  let { data: updated, error: dbError } = await supabase
    .from('checklist_items')
    .update(payload)
    .eq('id', itemId)
    .eq('checklist_id', checklistId)
    .eq('org_id', orgId)
    .select('id')
    .single()

  const errMsg = dbError?.message || ''
  let missingColumn =
    errMsg.includes('data_limite') || errMsg.includes('schema cache')

  if (dbError && dueDateEnabled && missingColumn && Object.prototype.hasOwnProperty.call(payload, 'data_limite')) {
    const payloadWithoutDate = { ...payload }
    delete payloadWithoutDate.data_limite
    log('warn', 'obras.checklist.item.update.fallback', {
      requestId,
      code: 'MISSING_COLUMN',
      route: '/api/v1/obras/[id]/checklists/[checklistId]/items/[itemId]',
      checklistId,
      itemId,
      error: dbError.message,
    })
    if (Object.keys(payloadWithoutDate).length > 0) {
      ;({ data: updated, error: dbError } = await supabase
        .from('checklist_items')
        .update(payloadWithoutDate)
        .eq('id', itemId)
        .eq('checklist_id', checklistId)
        .eq('org_id', orgId)
        .select('id')
        .single())
    } else {
      return ok(request, { skipped: true }, { warning: 'MISSING_COLUMN:data_limite' })
    }
  }

  if (dbError || !updated) {
    if ((dbError?.message || '').includes('infinite recursion')) {
      log('error', 'obras.checklist.item.update.failed', {
        requestId,
        code: 'RLS_RECURSION',
        route: '/api/v1/obras/[id]/checklists/[checklistId]/items/[itemId]',
        checklistId,
        itemId,
        error: dbError?.message,
      })
    }
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError?.message || 'Erro ao atualizar item' }, 500)
  }

  const fetched = await supabase
    .from('checklist_items')
    .select(CHECKLIST_ITEM_SELECT_WITH_DUE_DATE)
    .eq('id', updated.id)
    .eq('org_id', orgId)
    .single()

  let data = fetched.data
  const fetchError = fetched.error

  if (fetchError) {
    const fetchMsg = fetchError.message || ''
    const fetchMissingColumn = fetchMsg.includes('data_limite') || fetchMsg.includes('schema cache')
    if (!fetchMissingColumn) {
      return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: fetchError.message }, 500)
    }
    missingColumn = true
    const fallback = await supabase
      .from('checklist_items')
      .select(CHECKLIST_ITEM_SELECT)
      .eq('id', updated.id)
      .eq('org_id', orgId)
      .single()
    if (fallback.error || !fallback.data) {
      return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: fallback.error?.message || 'Erro ao carregar item' }, 500)
    }
    data = { ...fallback.data, data_limite: null }
  }
  const meta = missingColumn ? { warning: 'MISSING_COLUMN:data_limite' } : undefined
  return ok(request, data, meta)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; checklistId: string; itemId: string }> }
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
  const { id, checklistId, itemId } = await params

  const { data: checklist } = await supabase
    .from('obra_checklists')
    .select('id')
    .eq('id', checklistId)
    .eq('obra_id', id)
    .eq('org_id', orgId)
    .single()
  if (!checklist) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Checklist não encontrado' }, 404)
  }

  const { error: dbError } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', itemId)
    .eq('checklist_id', checklistId)
    .eq('org_id', orgId)

  if (dbError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }
  return ok(request, { deleted: true })
}
