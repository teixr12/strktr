import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { hasDomainPermission } from '@/lib/auth/domain-permissions'

type AlertSeverity = 'high' | 'medium' | 'low'

type TodayAlert = {
  code: string
  title: string
  severity: AlertSeverity
  module: 'obras' | 'leads' | 'financeiro' | 'compras'
  href: string
  meta?: Record<string, unknown>
}

function sortBySeverity(items: TodayAlert[]) {
  const rank: Record<AlertSeverity, number> = { high: 3, medium: 2, low: 1 }
  return items.sort((a, b) => rank[b.severity] - rank[a.severity])
}

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const today = new Date().toISOString().slice(0, 10)
  const warnings: string[] = []
  const alerts: TodayAlert[] = []

  try {
    const { data: blockedStages, error: blockedError } = await supabase
      .from('obra_etapas')
      .select('obra_id')
      .eq('org_id', orgId)
      .eq('status', 'Bloqueada')
      .limit(500)

    if (blockedError) throw blockedError
    const blockedCount = blockedStages?.length || 0
    if (blockedCount > 0) {
      alerts.push({
        code: 'BLOCKED_STAGE',
        title: `${blockedCount} etapa(s) bloqueada(s) em obras`,
        severity: blockedCount >= 3 ? 'high' : 'medium',
        module: 'obras',
        href: '/obras',
        meta: { blockedCount },
      })
    }
  } catch (err) {
    warnings.push('Falha ao calcular alertas de etapas bloqueadas')
    log('warn', 'alerts.today.blocked_stages.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/alerts/today',
      error: err instanceof Error ? err.message : 'unknown',
    })
  }

  try {
    const { data: checklists, error: checklistError } = await supabase
      .from('obra_checklists')
      .select('id, obra_id')
      .eq('org_id', orgId)
      .limit(500)

    if (checklistError) throw checklistError
    const checklistIds = (checklists || []).map((item) => item.id)
    if (checklistIds.length > 0) {
      const { data: overdueItems, error: overdueError } = await supabase
        .from('checklist_items')
        .select('id')
        .in('checklist_id', checklistIds)
        .eq('concluido', false)
        .lt('data_limite', today)
        .limit(500)

      if (overdueError) throw overdueError
      const overdueCount = overdueItems?.length || 0
      if (overdueCount > 0) {
        alerts.push({
          code: 'OVERDUE_CHECKLIST',
          title: `${overdueCount} item(ns) de checklist atrasado(s)`,
          severity: overdueCount >= 6 ? 'high' : 'medium',
          module: 'obras',
          href: '/obras',
          meta: { overdueCount },
        })
      }
    }
  } catch (err) {
    warnings.push('Falha ao calcular alertas de checklist')
    log('warn', 'alerts.today.overdue_checklist.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/alerts/today',
      error: err instanceof Error ? err.message : 'unknown',
    })
  }

  if (hasDomainPermission(role, 'can_manage_leads')) {
    try {
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, ultimo_contato, updated_at')
        .eq('org_id', orgId)
        .in('status', ['Novo', 'Qualificado', 'Proposta', 'Negociação'])
        .limit(300)

      if (leadsError) throw leadsError
      const now = Date.now()
      const stalled = (leads || []).filter((lead) => {
        const checkpoint = lead.ultimo_contato || lead.updated_at
        const elapsedHours = checkpoint ? (now - new Date(checkpoint).getTime()) / (1000 * 60 * 60) : 999
        return elapsedHours >= 48
      }).length

      if (stalled > 0) {
        alerts.push({
          code: 'LEAD_SLA_BREACHED',
          title: `${stalled} lead(s) sem follow-up no SLA`,
          severity: stalled >= 8 ? 'high' : 'medium',
          module: 'leads',
          href: '/leads',
          meta: { stalledLeads: stalled, slaHours: 48 },
        })
      }
    } catch (err) {
      warnings.push('Falha ao calcular alertas de SLA comercial')
      log('warn', 'alerts.today.leads_sla.failed', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/alerts/today',
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  if (hasDomainPermission(role, 'can_manage_finance')) {
    try {
      const [obrasRes, txRes] = await Promise.all([
        supabase
          .from('obras')
          .select('id, nome, valor_gasto')
          .eq('org_id', orgId)
          .limit(300),
        supabase
          .from('transacoes')
          .select('obra_id, tipo, valor')
          .eq('org_id', orgId)
          .eq('tipo', 'Despesa')
          .not('obra_id', 'is', null)
          .limit(2000),
      ])

      if (obrasRes.error) throw obrasRes.error
      if (txRes.error) throw txRes.error

      const despesasByObra = new Map<string, number>()
      for (const tx of txRes.data || []) {
        if (!tx.obra_id) continue
        despesasByObra.set(tx.obra_id, (despesasByObra.get(tx.obra_id) || 0) + Number(tx.valor || 0))
      }

      let topDeviation: { obraId: string; nome: string; pct: number } | null = null
      for (const obra of obrasRes.data || []) {
        const orcado = Number(obra.valor_gasto || 0)
        const realizado = despesasByObra.get(obra.id) || 0
        if (orcado <= 0 || realizado <= 0) continue
        const pct = ((realizado - orcado) / orcado) * 100
        if (pct <= 10) continue
        if (!topDeviation || pct > topDeviation.pct) {
          topDeviation = { obraId: obra.id, nome: obra.nome, pct }
        }
      }

      if (topDeviation) {
        alerts.push({
          code: 'BUDGET_DEVIATION',
          title: `Desvio financeiro em ${topDeviation.nome} (+${topDeviation.pct.toFixed(1)}%)`,
          severity: topDeviation.pct >= 20 ? 'high' : 'medium',
          module: 'financeiro',
          href: '/financeiro',
          meta: topDeviation,
        })
      }
    } catch (err) {
      warnings.push('Falha ao calcular alertas financeiros')
      log('warn', 'alerts.today.finance.failed', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/alerts/today',
        error: err instanceof Error ? err.message : 'unknown',
      })
    }

    try {
      const { data: urgentCompras, error: comprasError } = await supabase
        .from('compras')
        .select('id')
        .eq('org_id', orgId)
        .in('status', ['Solicitado', 'Aprovado', 'Pedido'])
        .in('urgencia', ['Alta', 'Urgente'])
        .lt('data_solicitacao', today)
        .limit(200)

      if (comprasError) throw comprasError
      const urgentCount = urgentCompras?.length || 0
      if (urgentCount > 0) {
        alerts.push({
          code: 'URGENT_PURCHASE_DELAY',
          title: `${urgentCount} compra(s) urgente(s) pendente(s)`,
          severity: urgentCount >= 4 ? 'high' : 'medium',
          module: 'compras',
          href: '/compras',
          meta: { urgentCount },
        })
      }
    } catch (err) {
      warnings.push('Falha ao calcular alertas de compras urgentes')
      log('warn', 'alerts.today.compras.failed', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/alerts/today',
        error: err instanceof Error ? err.message : 'unknown',
      })
    }

    try {
      const { data: pendingApprovals, error: approvalsError } = await supabase
        .from('aprovacoes_cliente')
        .select('id')
        .eq('org_id', orgId)
        .eq('status', 'pendente')
        .limit(300)

      if (approvalsError) throw approvalsError
      const pendingCount = pendingApprovals?.length || 0
      if (pendingCount > 0) {
        alerts.push({
          code: 'CLIENT_APPROVAL_PENDING',
          title: `${pendingCount} aprovação(ões) pendente(s) do cliente`,
          severity: pendingCount >= 5 ? 'high' : 'medium',
          module: 'financeiro',
          href: '/orcamentos',
          meta: { pendingApprovals: pendingCount },
        })
      }
    } catch (err) {
      warnings.push('Falha ao calcular alertas de aprovação do cliente')
      log('warn', 'alerts.today.approvals.failed', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/alerts/today',
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  const sorted = sortBySeverity(alerts).slice(0, 6)
  return ok(request, {
    alerts: sorted,
    totals: {
      high: sorted.filter((item) => item.severity === 'high').length,
      medium: sorted.filter((item) => item.severity === 'medium').length,
      low: sorted.filter((item) => item.severity === 'low').length,
      total: sorted.length,
    },
    warnings,
  })
}
