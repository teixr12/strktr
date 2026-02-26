import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { createOrcamentoSchema } from '@/shared/schemas/business'
import { ensurePendingApproval } from '@/server/services/portal/approval-service'

function computeTotal(
  items: Array<{ quantidade: number; valor_unitario: number }>
): number {
  return items.reduce(
    (sum, item) => sum + item.quantidade * item.valor_unitario,
    0
  )
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

  let query = supabase
    .from('orcamentos')
    .select('*, orcamento_itens(*)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status) query = query.eq('status', status)

  const { data, error: dbError } = await query
  if (dbError) {
    log('error', 'orcamentos.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/orcamentos',
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      500
    )
  }

  return ok(request, data ?? [], { count: data?.length || 0 })
}

export async function POST(request: Request) {
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

  const parsed = createOrcamentoSchema.safeParse(await request.json())
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

  const body = parsed.data
  if (body.exige_aprovacao_cliente && !body.obra_id) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'obra_id é obrigatório quando exige aprovação do cliente' },
      400
    )
  }
  if (body.exige_aprovacao_cliente && body.status === 'Aprovado') {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Não é possível aprovar orçamento sem decisão do cliente' },
      409
    )
  }

  const total = computeTotal(body.items)
  const { data: orcamento, error: createError } = await supabase
    .from('orcamentos')
    .insert({
      user_id: user.id,
      org_id: orgId,
      titulo: body.titulo,
      lead_id: body.lead_id || null,
      obra_id: body.obra_id || null,
      status: body.status,
      validade: body.validade || null,
      observacoes: body.observacoes || null,
      valor_total: total,
      exige_aprovacao_cliente: body.exige_aprovacao_cliente || false,
      aprovacao_cliente_id: null,
    })
    .select()
    .single()

  if (createError || !orcamento) {
    log('error', 'orcamentos.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/orcamentos',
      error: createError?.message || 'unknown',
    })
    return fail(
      request,
      {
        code: API_ERROR_CODES.DB_ERROR,
        message: createError?.message || 'Erro ao criar orçamento',
      },
      400
    )
  }

  const itemsPayload = body.items.map((item, index) => ({
    orcamento_id: orcamento.id,
    org_id: orgId,
    descricao: item.descricao,
    unidade: item.unidade,
    quantidade: item.quantidade,
    valor_unitario: item.valor_unitario,
    ordem: item.ordem ?? index,
  }))
  const { error: itemsError } = await supabase.from('orcamento_itens').insert(itemsPayload)
  if (itemsError) {
    log('error', 'orcamentos.create.items_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/orcamentos',
      orcamentoId: orcamento.id,
      error: itemsError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: itemsError.message },
      400
    )
  }

  if (body.exige_aprovacao_cliente && body.obra_id) {
    const ensuredApproval = await ensurePendingApproval({
      supabase,
      orgId,
      obraId: body.obra_id,
      userId: user.id,
      tipo: 'orcamento',
      orcamentoId: orcamento.id,
    })

    if (ensuredApproval.error || !ensuredApproval.data?.id) {
      return fail(
        request,
        {
          code: API_ERROR_CODES.DB_ERROR,
          message: ensuredApproval.error?.message || 'Erro ao criar aprovação do cliente',
        },
        400
      )
    }

    await supabase
      .from('orcamentos')
      .update({ aprovacao_cliente_id: ensuredApproval.data.id })
      .eq('id', orcamento.id)
      .eq('org_id', orgId)
  }

  const { data: hydrated, error: hydratedError } = await supabase
    .from('orcamentos')
    .select('*, orcamento_itens(*)')
    .eq('id', orcamento.id)
    .eq('org_id', orgId)
    .single()

  if (hydratedError) {
    return ok(request, { ...orcamento, orcamento_itens: itemsPayload }, undefined, 201)
  }

  return ok(request, hydrated, undefined, 201)
}
