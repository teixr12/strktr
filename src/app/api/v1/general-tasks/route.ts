import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { emitProductEvent } from '@/lib/telemetry'
import { createGeneralTaskSchema } from '@/shared/schemas/general-tasks'
import type { GeneralTask } from '@/shared/types/general-tasks'

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

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')?.trim() || null
  const q = searchParams.get('q')?.trim() || null
  const assignee = searchParams.get('assignee')?.trim() || null
  const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 50,
    maxPageSize: 100,
  })

  let query = supabase
    .from('general_tasks')
    .select(
      'id, org_id, created_by, assignee_user_id, title, description, status, priority, position, due_date, metadata, created_at, updated_at',
      { count: 'exact' }
    )
    .eq('org_id', orgId)

  if (status) query = query.eq('status', status)
  if (assignee === 'me') query = query.eq('assignee_user_id', user.id)
  else if (assignee && assignee !== 'all') query = query.eq('assignee_user_id', assignee)
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)

  const { data, count, error: dbError } = await query
    .order('status', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (dbError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  const items = (data || []) as GeneralTask[]
  const total = count ?? items.length
  return ok(request, items, buildPaginationMeta(items.length, total, page, pageSize))
}

export async function POST(request: Request) {
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

  const parsed = createGeneralTaskSchema.safeParse(await request.json().catch(() => null))
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

  const { data: inserted, error: insertError } = await supabase
    .from('general_tasks')
    .insert({
      org_id: orgId,
      created_by: user.id,
      assignee_user_id: parsed.data.assignee_user_id || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status || 'todo',
      priority: parsed.data.priority || 'medium',
      position: parsed.data.position || 0,
      due_date: parsed.data.due_date || null,
      metadata: parsed.data.metadata || {},
      updated_at: new Date().toISOString(),
    })
    .select(
      'id, org_id, created_by, assignee_user_id, title, description, status, priority, position, due_date, metadata, created_at, updated_at'
    )
    .single()

  if (insertError || !inserted) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: insertError?.message || 'Erro ao criar tarefa' },
      500
    )
  }

  if (inserted.assignee_user_id && inserted.assignee_user_id !== user.id) {
    try {
      await supabase
        .from('notificacoes')
        .insert({
          user_id: inserted.assignee_user_id,
          tipo: 'info',
          titulo: 'Nova tarefa atribuída',
          descricao: inserted.title,
          link: '/tarefas',
        })
    } catch {
      // best effort notification only
    }
  }

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'general_task_created',
    entityType: 'general_task',
    entityId: inserted.id,
    payload: {
      status: inserted.status,
      priority: inserted.priority,
      assignee_user_id: inserted.assignee_user_id,
    },
    mirrorExternal: true,
  }).catch(() => undefined)

  if (inserted.assignee_user_id) {
    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'general_task_assigned',
      entityType: 'general_task',
      entityId: inserted.id,
      payload: {
        assignee_user_id: inserted.assignee_user_id,
      },
      mirrorExternal: true,
    }).catch(() => undefined)
  }

  return ok(request, inserted as GeneralTask, { flag: 'NEXT_PUBLIC_FF_GENERAL_TASKS_V1' }, 201)
}
