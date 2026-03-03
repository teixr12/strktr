import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { emitProductEvent } from '@/lib/telemetry'
import { updateGeneralTaskSchema } from '@/shared/schemas/general-tasks'
import type { GeneralTask } from '@/shared/types/general-tasks'

async function ensureTaskByOrg(
  supabase: NonNullable<Awaited<ReturnType<typeof getApiUser>>['supabase']>,
  orgId: string,
  taskId: string
) {
  return supabase
    .from('general_tasks')
    .select(
      'id, org_id, created_by, assignee_user_id, title, description, status, priority, position, due_date, metadata, created_at, updated_at'
    )
    .eq('id', taskId)
    .eq('org_id', orgId)
    .maybeSingle()
}

async function validateAssignee(
  supabase: NonNullable<Awaited<ReturnType<typeof getApiUser>>['supabase']>,
  orgId: string,
  assigneeUserId: string
) {
  const { data, error } = await supabase
    .from('org_membros')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', assigneeUserId)
    .eq('status', 'ativo')
    .maybeSingle()

  if (error) return { valid: false, error: error.message }
  return { valid: Boolean(data), error: data ? null : 'Membro não encontrado na organização' }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error, orgId } = await getApiUser(request)
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

  const { id } = await params
  const { data: currentTask, error: taskError } = await ensureTaskByOrg(supabase, orgId, id)
  if (taskError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: taskError.message }, 500)
  }
  if (!currentTask) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Tarefa não encontrada' }, 404)
  }

  const parsed = updateGeneralTaskSchema.safeParse(await request.json().catch(() => null))
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

  if (parsed.data.assignee_user_id) {
    const assigneeCheck = await validateAssignee(supabase, orgId, parsed.data.assignee_user_id)
    if (!assigneeCheck.valid) {
      return fail(
        request,
        { code: API_ERROR_CODES.VALIDATION_ERROR, message: assigneeCheck.error || 'Atribuição inválida' },
        400
      )
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.title !== undefined) updates.title = parsed.data.title
  if (parsed.data.description !== undefined) updates.description = parsed.data.description
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority
  if (parsed.data.position !== undefined) updates.position = parsed.data.position
  if (parsed.data.due_date !== undefined) updates.due_date = parsed.data.due_date
  if (parsed.data.metadata !== undefined) updates.metadata = parsed.data.metadata
  if (parsed.data.assignee_user_id !== undefined) updates.assignee_user_id = parsed.data.assignee_user_id

  const { data: updated, error: updateError } = await supabase
    .from('general_tasks')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select(
      'id, org_id, created_by, assignee_user_id, title, description, status, priority, position, due_date, metadata, created_at, updated_at'
    )
    .single()

  if (updateError || !updated) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: updateError?.message || 'Erro ao atualizar tarefa' },
      500
    )
  }

  const assigneeChanged = updated.assignee_user_id !== currentTask.assignee_user_id
  if (assigneeChanged && updated.assignee_user_id) {
    try {
      await supabase
        .from('notificacoes')
        .insert({
          user_id: updated.assignee_user_id,
          tipo: 'info',
          titulo: 'Tarefa atribuída/atualizada',
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
      payload: { assignee_user_id: updated.assignee_user_id },
      mirrorExternal: true,
    }).catch(() => undefined)
  }

  return ok(request, updated as GeneralTask, { flag: 'NEXT_PUBLIC_FF_GENERAL_TASKS_V1' })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error, orgId } = await getApiUser(request)
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

  const { id } = await params
  const { error: dbError } = await supabase
    .from('general_tasks')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'core_delete',
    entityType: 'general_task',
    entityId: id,
    payload: { source: 'web' },
    mirrorExternal: true,
  }).catch(() => undefined)

  return ok(request, { success: true }, { flag: 'NEXT_PUBLIC_FF_GENERAL_TASKS_V1' })
}
