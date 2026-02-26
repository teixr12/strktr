import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getValidPortalSession } from '@/server/services/portal/session-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const service = createServiceRoleClient()
  if (!service) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: 'Service role não configurado no servidor' },
      500
    )
  }

  const { token } = await params
  const { session, error } = await getValidPortalSession(service, token)

  if (error || !session) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: 'Sessão do portal inválida ou expirada' }, 401)
  }

  const [obraRes, cronogramaRes, itensRes, diarioRes, aprovacoesRes, comentariosRes, portalClienteRes] = await Promise.all([
    service
      .from('obras')
      .select('id, nome, cliente, local, status, progresso, data_previsao')
      .eq('id', session.obra_id)
      .eq('org_id', session.org_id)
      .single(),
    service
      .from('cronograma_obras')
      .select('id, nome, data_inicio_planejada, data_fim_planejada')
      .eq('obra_id', session.obra_id)
      .eq('org_id', session.org_id)
      .maybeSingle(),
    service
      .from('cronograma_itens')
      .select('id, nome, status, empresa_responsavel, responsavel, data_inicio_planejada, data_fim_planejada, atraso_dias, progresso')
      .eq('obra_id', session.obra_id)
      .eq('org_id', session.org_id)
      .order('ordem', { ascending: true })
      .limit(300),
    service
      .from('diario_obra')
      .select('id, tipo, titulo, descricao, created_at')
      .eq('obra_id', session.obra_id)
      .eq('org_id', session.org_id)
      .order('created_at', { ascending: false })
      .limit(50),
    service
      .from('aprovacoes_cliente')
      .select('id, tipo, status, approval_version, compra_id, orcamento_id, solicitado_em, sla_due_at, decisao_comentario, decidido_em')
      .eq('obra_id', session.obra_id)
      .eq('org_id', session.org_id)
      .order('solicitado_em', { ascending: false })
      .limit(100),
    service
      .from('portal_comentarios')
      .select('id, origem, mensagem, created_at, portal_cliente_id, user_id, aprovacao_id')
      .eq('obra_id', session.obra_id)
      .eq('org_id', session.org_id)
      .order('created_at', { ascending: true })
      .limit(200),
    service
      .from('portal_clientes')
      .select('id, nome, email')
      .eq('id', session.portal_cliente_id)
      .maybeSingle(),
  ])

  if (obraRes.error || !obraRes.data) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada no portal' }, 404)
  }

  const compraIds = (aprovacoesRes.data || [])
    .map((item) => item.compra_id)
    .filter((value): value is string => Boolean(value))
  const orcamentoIds = (aprovacoesRes.data || [])
    .map((item) => item.orcamento_id)
    .filter((value): value is string => Boolean(value))
  const profileIds = Array.from(
    new Set(
      (comentariosRes.data || [])
        .map((comment) => comment.user_id)
        .filter((value): value is string => Boolean(value))
    )
  )

  const [comprasRes, orcamentosRes, clientesRes, profilesRes] = await Promise.all([
    compraIds.length > 0
      ? service
      .from('compras')
      .select('id, descricao, status, valor_estimado, valor_real, blocked_reason, approval_version')
          .in('id', compraIds)
          .eq('org_id', session.org_id)
      : Promise.resolve({ data: [], error: null }),
    orcamentoIds.length > 0
      ? service
      .from('orcamentos')
      .select('id, titulo, status, valor_total, blocked_reason, approval_version')
          .in('id', orcamentoIds)
          .eq('org_id', session.org_id)
      : Promise.resolve({ data: [], error: null }),
    service
      .from('portal_clientes')
      .select('id, nome')
      .eq('org_id', session.org_id)
      .eq('obra_id', session.obra_id),
    profileIds.length > 0
      ? service
          .from('profiles')
          .select('id, nome')
          .in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const comprasById = new Map((comprasRes.data || []).map((item) => [item.id, item]))
  const orcamentosById = new Map((orcamentosRes.data || []).map((item) => [item.id, item]))
  const clientesById = new Map((clientesRes.data || []).map((item) => [item.id, item.nome]))
  const profilesById = new Map((profilesRes.data || []).map((item) => [item.id, item.nome]))

  const aprovacoes = (aprovacoesRes.data || []).map((item) => ({
    id: item.id,
    tipo: item.tipo,
    status: item.status,
    approval_version: item.approval_version,
    solicitado_em: item.solicitado_em,
    sla_due_at: item.sla_due_at,
    decisao_comentario: item.decisao_comentario,
    decidido_em: item.decidido_em,
    compra: item.compra_id ? comprasById.get(item.compra_id) || null : null,
    orcamento: item.orcamento_id ? orcamentosById.get(item.orcamento_id) || null : null,
  }))

  const comentarios = (comentariosRes.data || []).map((comment) => ({
    ...comment,
    autor_nome:
      comment.origem === 'cliente'
        ? clientesById.get(comment.portal_cliente_id || '') || portalClienteRes.data?.nome || 'Cliente'
        : comment.origem === 'interno'
          ? profilesById.get(comment.user_id || '') || 'Equipe STRKTR'
          : 'Sistema STRKTR',
  }))

  return ok(
    request,
    {
      session: {
        sessionId: session.id,
        portalClienteId: session.portal_cliente_id,
        orgId: session.org_id,
        obraId: session.obra_id,
        expiresAt: session.expires_at,
      },
      portalCliente: portalClienteRes.data || null,
      obra: obraRes.data,
      cronograma: cronogramaRes.data || null,
      cronogramaItens: itensRes.data || [],
      diario: diarioRes.data || [],
      aprovacoes,
      comentarios,
    },
    { flag: 'NEXT_PUBLIC_FF_CLIENT_PORTAL' }
  )
}
