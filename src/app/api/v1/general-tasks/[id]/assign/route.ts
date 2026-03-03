import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { emitProductEvent } from '@/lib/telemetry'
import { assignGeneralTaskSchema } from '@/shared/schemas/general-tasks'
import type { GeneralTask } from '@/shared/types/general-tasks'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const parsed = assignGeneralTaskSchema.safeParse(await request.json().catch(() => null))
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

  const { id } = await params

  const { data: task, error: taskError } = await supabase
    .from('general_tasks')
    .select(
      'id, org_id, created_by, assignee_user_id, title, description, status, priority, position, due_date, metadata, created_at, updated_at'
    )
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (taskError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: taskError.message }, 500)
  }
  if (!task) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Tarefa não encontrada' }, 404)
  }

  const { data: assigneeMember, error: assigneeError } = await supabase
    .from('org_membros')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', parsed.data.assignee_user_id)
    .eq('status', 'ativo')
    .maybeSingle()

  if (assigneeError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: assigneeError.message }, 500)
  }
  if (!assigneeMember) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Membro não encontrado na organização' },
      400
    )
  }

  const { data: updated, error: updateError } = await supabase
    .from('general_tasks')
    .update({
      assignee_user_id: parsed.data.assignee_user_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', task.id)
    .eq('org_id', orgId)
    .select(
      'id, org_id, created_by, assignee_user_id, title, description, status, priority, position, due_date, metadata, created_at, updated_at'
    )
    .single()

  if (updateError || !updated) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: updateError?.message || 'Erro ao atribuir tarefa' },
      500
    )
  }

  try {
    await supabase
      .from('notificacoes')
      .insert({
        user_id: parsed.data.assignee_user_id,
        tipo: 'info',
        titulo: 'Tarefa atribuída',
        descricao: updated.title,
        link: '/tarefas',
      })
  } catch {
    // best effort notification only
  }

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'general_task_assigned',
    entityType: 'general_task',
    entityId: updated.id,
    payload: {
      assignee_user_id: parsed.data.assignee_user_id,
      previous_assignee_user_id: task.assignee_user_id,
    },
    mirrorExternal: true,
  }).catch(() => undefined)

  return ok(request, updated as GeneralTask, { flag: 'NEXT_PUBLIC_FF_TASK_ASSIGN_V1' })
}
