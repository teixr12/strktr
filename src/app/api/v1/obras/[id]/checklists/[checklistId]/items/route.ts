import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { requireExecutionPermission } from '@/lib/auth/execution-permissions'
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

  let { data, error: dbError } = await supabase
    .from('checklist_items')
    .insert(payload)
    .select('*')
    .single()

  const errMsg = dbError?.message || ''
  const missingColumn =
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
    ;({ data, error: dbError } = await supabase
      .from('checklist_items')
      .insert(basePayload)
      .select('*')
      .single())
  }

  if (dbError || !data) {
    if ((dbError?.message || '').includes('infinite recursion')) {
      log('error', 'obras.checklist.item.create.failed', {
        requestId,
        code: 'RLS_RECURSION',
        route: '/api/v1/obras/[id]/checklists/[checklistId]/items',
        checklistId,
        error: dbError?.message,
      })
    }
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError?.message || 'Erro ao criar item' }, 400)
  }

  const meta = missingColumn ? { warning: 'MISSING_COLUMN:data_limite' } : undefined
  return ok(request, data, meta, 201)
}
