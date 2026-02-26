import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import type { AgendaTask } from '@/shared/types/cronograma'

function severityRank(severity: AgendaTask['severity']) {
  if (severity === 'high') return 3
  if (severity === 'medium') return 2
  return 1
}

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const today = new Date().toISOString().slice(0, 10)
  const horizon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const tasks: AgendaTask[] = []
  const warnings: string[] = []

  try {
    const { data: visitas, error: visitasError } = await supabase
      .from('visitas')
      .select('id, titulo, data_hora, status, obra_id, lead_id')
      .eq('org_id', orgId)
      .in('status', ['Agendado', 'Reagendado'])
      .gte('data_hora', new Date().toISOString())
      .lte('data_hora', horizon)
      .order('data_hora', { ascending: true })
      .limit(60)

    if (visitasError) throw visitasError

    for (const visita of visitas || []) {
      tasks.push({
        code: `VISITA_${visita.id}`,
        title: `Visita: ${visita.titulo}`,
        severity: 'low',
        source: 'visita',
        dueAt: visita.data_hora,
        href: '/calendario',
        meta: { visitaId: visita.id, status: visita.status, obraId: visita.obra_id, leadId: visita.lead_id },
      })
    }
  } catch (err) {
    warnings.push('Falha ao carregar visitas da agenda')
    log('warn', 'agenda.arquiteto.visitas_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/agenda/arquiteto',
      error: err instanceof Error ? err.message : 'unknown',
    })
  }

  try {
    const { data: checklistMap, error: checklistMapError } = await supabase
      .from('obra_checklists')
      .select('id, nome, obra_id')
      .eq('org_id', orgId)
      .limit(600)

    if (checklistMapError) throw checklistMapError

    const checklistIds = (checklistMap || []).map((item) => item.id)
    if (checklistIds.length > 0) {
      const { data: overdueItems, error: overdueError } = await supabase
        .from('checklist_items')
        .select('id, checklist_id, descricao, data_limite')
        .in('checklist_id', checklistIds)
        .eq('concluido', false)
        .lt('data_limite', today)
        .limit(300)

      if (overdueError) throw overdueError

      const checklistById = new Map((checklistMap || []).map((item) => [item.id, item]))
      for (const item of overdueItems || []) {
        const checklist = checklistById.get(item.checklist_id)
        tasks.push({
          code: `CHECKLIST_OVERDUE_${item.id}`,
          title: `Checklist atrasado: ${item.descricao}`,
          severity: 'high',
          source: 'checklist',
          dueAt: item.data_limite,
          href: checklist?.obra_id ? `/obras/${checklist.obra_id}` : '/obras',
          meta: {
            checklistId: item.checklist_id,
            checklistNome: checklist?.nome || null,
            obraId: checklist?.obra_id || null,
          },
        })
      }
    }
  } catch (err) {
    warnings.push('Falha ao calcular checklists atrasados')
    log('warn', 'agenda.arquiteto.checklists_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/agenda/arquiteto',
      error: err instanceof Error ? err.message : 'unknown',
    })
  }

  try {
    const { data: delayedItems, error: delayedError } = await supabase
      .from('cronograma_itens')
      .select('id, obra_id, nome, data_fim_planejada, atraso_dias, status')
      .eq('org_id', orgId)
      .neq('status', 'concluido')
      .lt('data_fim_planejada', today)
      .order('atraso_dias', { ascending: false })
      .limit(200)

    if (delayedError) throw delayedError

    for (const item of delayedItems || []) {
      tasks.push({
        code: `CRONOGRAMA_DELAY_${item.id}`,
        title: `Cronograma atrasado: ${item.nome}`,
        severity: Number(item.atraso_dias || 0) >= 3 || item.status === 'bloqueado' ? 'high' : 'medium',
        source: 'cronograma',
        dueAt: item.data_fim_planejada,
        href: item.obra_id ? `/obras/${item.obra_id}` : '/obras',
        meta: { itemId: item.id, obraId: item.obra_id, atrasoDias: item.atraso_dias || 0, status: item.status },
      })
    }
  } catch (err) {
    warnings.push('Falha ao calcular atrasos de cronograma')
    log('warn', 'agenda.arquiteto.cronograma_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/agenda/arquiteto',
      error: err instanceof Error ? err.message : 'unknown',
    })
  }

  try {
    const { data: approvals, error: approvalsError } = await supabase
      .from('aprovacoes_cliente')
      .select('id, tipo, status, solicitado_em, sla_due_at')
      .eq('org_id', orgId)
      .in('status', ['pendente', 'reprovado'])
      .order('solicitado_em', { ascending: false })
      .limit(120)

    if (approvalsError) throw approvalsError

    for (const approval of approvals || []) {
      const isRejectedOverdue =
        approval.status === 'reprovado' &&
        Boolean(approval.sla_due_at) &&
        new Date(approval.sla_due_at).getTime() < Date.now()

      tasks.push({
        code: `APROVACAO_${approval.id}`,
        title: isRejectedOverdue
          ? `SLA vencido após reprovação (${approval.tipo})`
          : `Aprovação cliente pendente (${approval.tipo})`,
        severity: isRejectedOverdue ? 'high' : 'medium',
        source: 'aprovacao',
        dueAt: approval.sla_due_at || approval.solicitado_em,
        href: approval.tipo === 'compra' ? '/compras' : '/orcamentos',
        meta: { approvalId: approval.id, tipo: approval.tipo, status: approval.status, slaDueAt: approval.sla_due_at },
      })
    }
  } catch (err) {
    warnings.push('Falha ao carregar pendências de aprovação')
    log('warn', 'agenda.arquiteto.approvals_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/agenda/arquiteto',
      error: err instanceof Error ? err.message : 'unknown',
    })
  }

  const sorted = tasks
    .sort((a, b) => {
      const diff = severityRank(b.severity) - severityRank(a.severity)
      if (diff !== 0) return diff
      if (!a.dueAt) return 1
      if (!b.dueAt) return -1
      return a.dueAt.localeCompare(b.dueAt)
    })
    .slice(0, 80)

  return ok(request, {
    tasks: sorted,
    totals: {
      high: sorted.filter((task) => task.severity === 'high').length,
      medium: sorted.filter((task) => task.severity === 'medium').length,
      low: sorted.filter((task) => task.severity === 'low').length,
      total: sorted.length,
    },
    warnings,
  }, { flag: 'NEXT_PUBLIC_FF_ARCHITECT_AGENDA' })
}
