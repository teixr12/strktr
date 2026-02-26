import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateOrcamentoSchema } from '@/shared/schemas/business'

function computeTotal(
  items: Array<{ quantidade: number; valor_unitario: number }>
): number {
  return items.reduce(
    (sum, item) => sum + item.quantidade * item.valor_unitario,
    0
  )
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('orcamentos')
    .select('*, orcamento_itens(*)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (dbError) {
    log('error', 'orcamentos.getById.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/orcamentos/[id]',
      orcamentoId: id,
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: dbError.message },
      404
    )
  }

  return ok(request, data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const parsed = updateOrcamentoSchema.safeParse(await request.json())
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
  const payload = parsed.data
  const { id } = await params

  let computedTotal: number | undefined = undefined
  if (payload.items && payload.items.length > 0) {
    computedTotal = computeTotal(payload.items)
  }

  const { data: updated, error: updateError } = await supabase
    .from('orcamentos')
    .update({
      titulo: payload.titulo,
      lead_id: payload.lead_id === undefined ? undefined : payload.lead_id || null,
      obra_id: payload.obra_id === undefined ? undefined : payload.obra_id || null,
      status: payload.status,
      validade: payload.validade === undefined ? undefined : payload.validade || null,
      observacoes: payload.observacoes === undefined ? undefined : payload.observacoes || null,
      valor_total: computedTotal,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (updateError || !updated) {
    log('error', 'orcamentos.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/orcamentos/[id]',
      orcamentoId: id,
      error: updateError?.message || 'unknown',
    })
    return fail(
      request,
      {
        code: API_ERROR_CODES.DB_ERROR,
        message: updateError?.message || 'Erro ao atualizar orçamento',
      },
      400
    )
  }

  if (payload.items) {
    const { error: deleteItemsError } = await supabase
      .from('orcamento_itens')
      .delete()
      .eq('orcamento_id', id)
    if (deleteItemsError) {
      return fail(
        request,
        { code: API_ERROR_CODES.DB_ERROR, message: deleteItemsError.message },
        400
      )
    }

    const itemsPayload = payload.items.map((item, index) => ({
      orcamento_id: id,
      org_id: orgId,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      ordem: item.ordem ?? index,
    }))
    const { error: itemsError } = await supabase.from('orcamento_itens').insert(itemsPayload)
    if (itemsError) {
      return fail(
        request,
        { code: API_ERROR_CODES.DB_ERROR, message: itemsError.message },
        400
      )
    }
  }

  const { data: hydrated } = await supabase
    .from('orcamentos')
    .select('*, orcamento_itens(*)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  return ok(request, hydrated || updated)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const { id } = await params
  const { error: dbError } = await supabase
    .from('orcamentos')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbError) {
    log('error', 'orcamentos.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/orcamentos/[id]',
      orcamentoId: id,
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      400
    )
  }

  return ok(request, { success: true })
}
