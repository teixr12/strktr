import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { canManageExecutionStructure, requireExecutionPermission } from '@/lib/auth/execution-permissions'
import { createChecklistSchema } from '@/shared/schemas/execution'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('obra_checklists')
    .select('*, checklist_items(*)')
    .eq('obra_id', id)
    .eq('org_id', orgId)
    .order('ordem')

  if (dbError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  return ok(request, data ?? [])
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Somente admin/manager podem criar checklists' },
      403
    )
  }
  const { id } = await params
  const parsed = createChecklistSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' }, 400)
  }
  const payload = parsed.data

  const { data: obra } = await supabase
    .from('obras')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (!obra) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const { data: maxChecklist } = await supabase
    .from('obra_checklists')
    .select('ordem')
    .eq('obra_id', id)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxChecklist?.ordem ?? 0) + 1

  const { data, error: dbError } = await supabase
    .from('obra_checklists')
    .insert({
      obra_id: id,
      user_id: user.id,
      org_id: orgId,
      tipo: payload.tipo || 'custom',
      nome: payload.nome,
      ordem: nextOrder,
    })
    .select('*')
    .single()

  if (dbError || !data) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError?.message || 'Erro ao criar checklist' }, 400)
  }

  await supabase.from('diario_obra').insert({
    obra_id: id,
    user_id: user.id,
    org_id: orgId,
    tipo: 'checklist',
    titulo: 'Checklist criado',
    descricao: data.nome,
    metadata: { checklistId: data.id, tipo: data.tipo },
  })

  return ok(request, data, undefined, 201)
}
