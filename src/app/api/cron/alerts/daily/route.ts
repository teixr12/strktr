import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { createServiceRoleClient } from '@/lib/supabase/service'

function isCronAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET
  if (!configuredSecret) return true

  const auth = request.headers.get('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return bearer === configuredSecret
}

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: 'Não autorizado para cron' }, 401)
  }

  const service = createServiceRoleClient()
  if (!service) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: 'Service role não configurado' }, 500)
  }

  const today = new Date().toISOString().slice(0, 10)
  const results: Array<{ orgId: string; createdNotifications: number }> = []

  const { data: orgs, error: orgsError } = await service
    .from('organizacoes')
    .select('id')
    .limit(500)

  if (orgsError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: orgsError.message }, 500)
  }

  for (const org of orgs || []) {
    const orgId = org.id as string

    const [membersRes, delayedCronRes, pendingApprovalsRes, rejectedSlaRes, checklistsRes] = await Promise.all([
      service
        .from('org_membros')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('status', 'ativo')
        .in('role', ['admin', 'manager']),
      service
        .from('cronograma_itens')
        .select('id')
        .eq('org_id', orgId)
        .neq('status', 'concluido')
        .lt('data_fim_planejada', today)
        .limit(400),
      service
        .from('aprovacoes_cliente')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'pendente')
        .limit(400),
      service
        .from('aprovacoes_cliente')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'reprovado')
        .not('sla_due_at', 'is', null)
        .lt('sla_due_at', new Date().toISOString())
        .is('sla_alert_sent_at', null)
        .limit(200),
      service
        .from('obra_checklists')
        .select('id')
        .eq('org_id', orgId)
        .limit(600),
    ])

    if (membersRes.error || delayedCronRes.error || pendingApprovalsRes.error || rejectedSlaRes.error || checklistsRes.error) {
      continue
    }

    const checklistIds = (checklistsRes.data || []).map((item) => item.id)
    let overdueChecklistCount = 0
    if (checklistIds.length > 0) {
      const { data: overdueChecklist } = await service
        .from('checklist_items')
        .select('id')
        .in('checklist_id', checklistIds)
        .eq('concluido', false)
        .lt('data_limite', today)
        .limit(400)

      overdueChecklistCount = (overdueChecklist || []).length
    }

    const delayedCronCount = (delayedCronRes.data || []).length
    const pendingApprovalsCount = (pendingApprovalsRes.data || []).length
    const rejectedSlaCount = (rejectedSlaRes.data || []).length

    if (delayedCronCount + pendingApprovalsCount + overdueChecklistCount + rejectedSlaCount === 0) {
      results.push({ orgId, createdNotifications: 0 })
      continue
    }

    const titulo = 'Resumo operacional diário'
    const descricao = [
      `${delayedCronCount} item(ns) de cronograma atrasado(s)`,
      `${overdueChecklistCount} item(ns) de checklist atrasado(s)`,
      `${pendingApprovalsCount} aprovação(ões) pendente(s) do cliente`,
      `${rejectedSlaCount} reprovação(ões) com SLA vencido`,
    ].join(' · ')

    const payload = (membersRes.data || []).map((member) => ({
      user_id: member.user_id,
      tipo: delayedCronCount > 0 || overdueChecklistCount > 0 || rejectedSlaCount > 0 ? 'warning' : 'info',
      titulo,
      descricao,
      link: '/dashboard',
    }))

    if (payload.length > 0) {
      await service.from('notificacoes').insert(payload)
    }

    if (rejectedSlaCount > 0) {
      await service
        .from('aprovacoes_cliente')
        .update({ sla_alert_sent_at: new Date().toISOString() })
        .in('id', (rejectedSlaRes.data || []).map((item) => item.id))
        .eq('org_id', orgId)
    }

    results.push({ orgId, createdNotifications: payload.length })
  }

  return ok(request, {
    ranAt: new Date().toISOString(),
    organizations: results.length,
    details: results,
  })
}
