import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateOrcamentoSchema } from '@/shared/schemas/business'
import { ensurePendingApproval, getApprovalStatus } from '@/server/services/portal/approval-service'

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

  const { data: existingOrcamento, error: existingOrcamentoError } = await supabase
    .from('orcamentos')
    .select('id, obra_id, status, exige_aprovacao_cliente, aprovacao_cliente_id, approval_version')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (existingOrcamentoError || !existingOrcamento) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Orçamento não encontrado' }, 404)
  }

  const targetStatus = payload.status || existingOrcamento.status
  const targetExigeAprovacao = payload.exige_aprovacao_cliente ?? existingOrcamento.exige_aprovacao_cliente ?? false
  const targetObraId = payload.obra_id === undefined ? existingOrcamento.obra_id : payload.obra_id
  const shouldResubmitApproval = Boolean(payload.reenviar_aprovacao_cliente)
  const approvalStatus = targetExigeAprovacao
    ? await getApprovalStatus(supabase, orgId, existingOrcamento.aprovacao_cliente_id)
    : { status: null, error: null, approvalVersion: null as number | null }

  if (targetExigeAprovacao && !targetObraId) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'obra_id é obrigatório quando exige aprovação do cliente' },
      400
    )
  }

  if (approvalStatus.error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: approvalStatus.error.message }, 500)
  }

  if (targetExigeAprovacao && targetStatus === 'Aprovado' && approvalStatus.status !== 'aprovado') {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: approvalStatus.status === 'reprovado'
          ? 'Orçamento reprovado pelo cliente. Crie nova versão e reenviar aprovação.'
          : 'Orçamento bloqueado até aprovação do cliente',
      },
      409
    )
  }

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
      exige_aprovacao_cliente: payload.exige_aprovacao_cliente,
      blocked_reason: targetExigeAprovacao && approvalStatus.status === 'reprovado' && !shouldResubmitApproval
        ? 'Reprovado pelo cliente. Reenviar nova versão para liberação.'
        : null,
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
      500
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
        500
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
        500
      )
    }
  }

  if (targetExigeAprovacao && targetObraId) {
    if (approvalStatus.status === 'reprovado' && shouldResubmitApproval) {
      const nextVersion = Math.max(existingOrcamento.approval_version || 1, approvalStatus.approvalVersion || 1) + 1
      const ensuredApproval = await ensurePendingApproval({
        supabase,
        orgId,
        obraId: targetObraId,
        userId: user.id,
        tipo: 'orcamento',
        approvalVersion: nextVersion,
        predecessorApprovalId: existingOrcamento.aprovacao_cliente_id,
        forceNew: true,
        orcamentoId: id,
      })

      if (ensuredApproval.error || !ensuredApproval.data?.id) {
        return fail(
          request,
          {
            code: API_ERROR_CODES.DB_ERROR,
            message: ensuredApproval.error?.message || 'Erro ao preparar aprovação do cliente',
          },
          500
        )
      }

      await supabase
        .from('orcamentos')
        .update({
          aprovacao_cliente_id: ensuredApproval.data.id,
          approval_version: nextVersion,
          status: 'Pendente Aprovação Cliente',
          blocked_reason: null,
        })
        .eq('id', id)
        .eq('org_id', orgId)
    } else if (approvalStatus.status !== 'aprovado') {
      const currentVersion = Math.max(existingOrcamento.approval_version || 1, approvalStatus.approvalVersion || 1)
      const ensuredApproval = await ensurePendingApproval({
        supabase,
        orgId,
        obraId: targetObraId,
        userId: user.id,
        tipo: 'orcamento',
        approvalVersion: currentVersion,
        orcamentoId: id,
      })

      if (ensuredApproval.error || !ensuredApproval.data?.id) {
        return fail(
          request,
          {
            code: API_ERROR_CODES.DB_ERROR,
            message: ensuredApproval.error?.message || 'Erro ao preparar aprovação do cliente',
          },
          500
        )
      }

      await supabase
        .from('orcamentos')
        .update({
          aprovacao_cliente_id: ensuredApproval.data.id,
          approval_version: currentVersion,
        })
        .eq('id', id)
        .eq('org_id', orgId)
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
      500
    )
  }

  return ok(request, { success: true })
}
