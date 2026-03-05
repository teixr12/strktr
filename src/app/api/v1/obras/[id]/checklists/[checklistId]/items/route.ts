import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { requireExecutionPermission } from '@/lib/auth/execution-permissions'
import { CHECKLIST_ITEM_SELECT, CHECKLIST_ITEM_SELECT_WITH_DUE_DATE } from '@/lib/api/select-maps'
import { createChecklistItemSchema } from '@/shared/schemas/execution'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; checklistId: string }> }
) {
  const { user, supabase, error, orgId, requestId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireExecutionPermission(request, role, 'can_toggle_checklist')
  if (permissionError) return permissionError
  const { id, checklistId } = await params
  const parsed = createChecklistItemSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' }, 400)
  }
  const payloadInput = parsed.data

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

  const { data: maxItem } = await supabase
    .from('checklist_items')
    .select('ordem')
    .eq('checklist_id', checklistId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxItem?.ordem ?? 0) + 1

  const dueDateEnabled = isFeatureEnabled('checklistDueDate')
  const basePayload = {
    checklist_id: checklistId,
    org_id: orgId,
    descricao: payloadInput.descricao,
    ordem: nextOrder,
  }

  const payload = dueDateEnabled
    ? { ...basePayload, data_limite: payloadInput?.data_limite || null }
    : basePayload

  let { data: created, error: dbError } = await supabase
    .from('checklist_items')
    .insert(payload)
    .select('id')
    .single()

  const errMsg = dbError?.message || ''
  let missingColumn =
    errMsg.includes('data_limite') || errMsg.includes('schema cache')
  if (dbError && dueDateEnabled && missingColumn) {
    log('warn', 'obras.checklist.item.create.fallback', {
      requestId,
      code: 'MISSING_COLUMN',
      route: '/api/v1/obras/[id]/checklists/[checklistId]/items',
      checklistId,
      itemPayload: 'without_data_limite',
      error: dbError.message,
    })
    ;({ data: created, error: dbError } = await supabase
      .from('checklist_items')
      .insert(basePayload)
      .select('id')
      .single())
  }

  if (dbError || !created) {
    if ((dbError?.message || '').includes('infinite recursion')) {
      log('error', 'obras.checklist.item.create.failed', {
        requestId,
        code: 'RLS_RECURSION',
        route: '/api/v1/obras/[id]/checklists/[checklistId]/items',
        checklistId,
        error: dbError?.message,
      })
    }
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError?.message || 'Erro ao criar item' }, 500)
  }

  const fetched = await supabase
    .from('checklist_items')
    .select(CHECKLIST_ITEM_SELECT_WITH_DUE_DATE)
    .eq('id', created.id)
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
      .eq('id', created.id)
      .eq('org_id', orgId)
      .single()
    if (fallback.error || !fallback.data) {
      return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: fallback.error?.message || 'Erro ao carregar item' }, 500)
    }
    data = { ...fallback.data, data_limite: null }
  }

  const meta = missingColumn ? { warning: 'MISSING_COLUMN:data_limite' } : undefined
  return ok(request, data, meta, 201)
}
