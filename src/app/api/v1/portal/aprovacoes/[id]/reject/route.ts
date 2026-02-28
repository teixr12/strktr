import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { emitProductEvent } from '@/lib/telemetry'
import { getValidPortalSession } from '@/server/services/portal/session-service'
import { runAutomation } from '@/server/services/automation/automation-service'
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
    .select('id, org_id, obra_id, tipo, status, compra_id, orcamento_id, approval_version, solicitado_por')
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
  const slaDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { data: updated, error: updateError } = await service
    .from('aprovacoes_cliente')
    .update({
      status: 'reprovado',
      decidido_por_portal_cliente_id: session.portal_cliente_id,
      decisao_comentario: comentario,
      decidido_em: nowIso,
      sla_due_at: slaDueAt,
      sla_alert_sent_at: null,
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
      .update({
        status: 'Revisão Cliente',
        aprovacao_cliente_id: approval.id,
        approval_version: approval.approval_version || 1,
        blocked_reason: 'Reprovado pelo cliente. Revise e reenviar nova versão.',
      })
      .eq('id', approval.compra_id)
      .eq('org_id', session.org_id)
  }

  if (approval.tipo === 'orcamento' && approval.orcamento_id) {
    await service
      .from('orcamentos')
      .update({
        status: 'Revisão Cliente',
        aprovacao_cliente_id: approval.id,
        approval_version: approval.approval_version || 1,
        blocked_reason: 'Reprovado pelo cliente. Revise e reenviar nova versão.',
      })
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

  const { data: leaders } = await service
    .from('org_membros')
    .select('user_id')
    .eq('org_id', session.org_id)
    .eq('status', 'ativo')
    .in('role', ['admin', 'manager'])

  const notifications = (leaders || []).map((member) => ({
    user_id: member.user_id,
    tipo: 'urgent',
    titulo: 'Aprovação reprovada pelo cliente',
    descricao: `Ação até ${new Date(slaDueAt).toLocaleDateString('pt-BR')}: revisar e reenviar versão ${Number(approval.approval_version || 1) + 1}.`,
    link: approval.tipo === 'compra' ? '/compras' : '/orcamentos',
  }))

  if (notifications.length > 0) {
    await service.from('notificacoes').insert(notifications)
  }

  const automationUserId = approval.solicitado_por || notifications[0]?.user_id || null

  if (
    process.env.NEXT_PUBLIC_FF_SEMI_AUTOMATION !== 'false' &&
    automationUserId
  ) {
    await runAutomation(
      service,
      {
        orgId: session.org_id,
        userId: automationUserId,
        trigger: 'ApprovalRejected',
        triggerEntityType: approval.tipo,
        triggerEntityId: approval.id,
        payload: {
          approvalType: approval.tipo,
          approvalVersion: approval.approval_version || 1,
        },
      },
      {
        confirm: true,
        source: 'trigger',
      }
    ).catch(() => undefined)
  }

  await emitProductEvent({
    supabase: service,
    orgId: session.org_id,
    userId: session.portal_cliente_id,
    eventType: 'portal_approval_decision',
    entityType: 'portal_approval',
    entityId: approval.id,
    payload: {
      decision: 'reject',
      approvalType: approval.tipo,
      approvalVersion: approval.approval_version || 1,
      requiredNextVersion: Number(approval.approval_version || 1) + 1,
    },
  }).catch(() => undefined)

  return ok(
    request,
    {
      rejected: true,
      aprovacao: updated,
      slaDueAt,
      requiredNextVersion: Number(approval.approval_version || 1) + 1,
    },
    { flag: 'NEXT_PUBLIC_FF_APPROVAL_GATE' }
  )
}
