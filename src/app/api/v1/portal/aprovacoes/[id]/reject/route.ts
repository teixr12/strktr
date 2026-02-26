import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getValidPortalSession } from '@/server/services/portal/session-service'
import { rejectDecisionSchema } from '@/shared/schemas/cronograma-portal'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const service = createServiceRoleClient()
  if (!service) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: 'Service role não configurado' }, 500)
  }

  const parsed = rejectDecisionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }

  const { token, comentario } = parsed.data
  const { session, error } = await getValidPortalSession(service, token)
  if (error || !session) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: 'Sessão do portal inválida ou expirada' }, 401)
  }

  const { id: aprovacaoId } = await params
  const { data: approval, error: approvalError } = await service
    .from('aprovacoes_cliente')
    .select('id, org_id, obra_id, tipo, status, compra_id, orcamento_id')
    .eq('id', aprovacaoId)
    .eq('org_id', session.org_id)
    .eq('obra_id', session.obra_id)
    .single()

  if (approvalError || !approval) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Aprovação não encontrada' }, 404)
  }

  if (approval.status !== 'pendente') {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Esta aprovação já foi decidida' }, 409)
  }

  const nowIso = new Date().toISOString()
  const { data: updated, error: updateError } = await service
    .from('aprovacoes_cliente')
    .update({
      status: 'reprovado',
      decidido_por_portal_cliente_id: session.portal_cliente_id,
      decisao_comentario: comentario,
      decidido_em: nowIso,
    })
    .eq('id', approval.id)
    .eq('org_id', session.org_id)
    .select('*')
    .single()

  if (updateError || !updated) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: updateError?.message || 'Erro ao reprovar' }, 400)
  }

  if (approval.tipo === 'compra' && approval.compra_id) {
    await service
      .from('compras')
      .update({ status: 'Cancelado', aprovacao_cliente_id: approval.id })
      .eq('id', approval.compra_id)
      .eq('org_id', session.org_id)
  }

  if (approval.tipo === 'orcamento' && approval.orcamento_id) {
    await service
      .from('orcamentos')
      .update({ status: 'Recusado', aprovacao_cliente_id: approval.id })
      .eq('id', approval.orcamento_id)
      .eq('org_id', session.org_id)
  }

  await service.from('portal_comentarios').insert({
    org_id: session.org_id,
    obra_id: session.obra_id,
    portal_cliente_id: session.portal_cliente_id,
    user_id: null,
    aprovacao_id: approval.id,
    origem: 'cliente',
    mensagem: comentario,
  })

  return ok(request, { rejected: true, aprovacao: updated }, { flag: 'NEXT_PUBLIC_FF_APPROVAL_GATE' })
}
