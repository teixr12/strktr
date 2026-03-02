import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { KANBAN_COLUMNS } from '@/lib/constants'

/**
 * GET /api/v1/dashboard/summary
 *
 * Pre-computed dashboard KPIs + lists.
 * Replaces the 7 raw-entity fetches (840 rows / ~200KB) with a single ~3-5KB response.
 */
export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
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

  try {
    // ---------- Parallel queries ----------
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10)

    const [
      obrasAtivasRes,
      leadsAtivosRes,
      comprasPendentesRes,
      transacoesRes,
      leadsAllRes,
      hotLeadsRes,
      topObrasRes,
      proximasVisitasRes,
      obrasCountRes,
      leadsCountRes,
    ] = await Promise.all([
      // KPI: obras ativas count
      supabase
        .from('obras')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'Em Andamento'),

      // KPI: leads ativos count (not Perdido)
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .neq('status', 'Perdido'),

      // KPI: compras pendentes count
      supabase
        .from('compras')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['Pendente Aprovação Cliente', 'Revisão Cliente']),

      // Finance chart: lightweight transacoes for last 6 months
      supabase
        .from('transacoes')
        .select('tipo, valor, data')
        .eq('org_id', orgId)
        .gte('data', sixMonthsAgoStr)
        .order('data', { ascending: true }),

      // Pipeline: all leads with status + valor_potencial
      supabase
        .from('leads')
        .select('status, valor_potencial')
        .eq('org_id', orgId),

      // List: hot leads (top 3)
      supabase
        .from('leads')
        .select('id, nome, origem, valor_potencial')
        .eq('org_id', orgId)
        .eq('temperatura', 'Hot')
        .order('created_at', { ascending: false })
        .limit(3),

      // List: top obras (top 3)
      supabase
        .from('obras')
        .select('id, nome, cliente, local, status, etapa_atual, progresso, valor_contrato')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(3),

      // List: próximas visitas (top 5)
      supabase
        .from('visitas')
        .select('id, titulo, tipo, status, data_hora')
        .eq('org_id', orgId)
        .eq('status', 'Agendado')
        .order('data_hora', { ascending: true })
        .limit(5),

      // Onboarding: total obras count
      supabase
        .from('obras')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      // Onboarding: total leads count
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),
    ])

    // ---------- Compute KPIs ----------
    const obrasAtivas = obrasAtivasRes.count ?? 0
    const leadsAtivos = leadsAtivosRes.count ?? 0
    const compraPendenteCount = comprasPendentesRes.count ?? 0

    const transacoes = transacoesRes.data ?? []
    let receitas = 0
    let despesas = 0
    let receitasCount = 0
    let despesasCount = 0
    for (const t of transacoes) {
      if (t.tipo === 'Receita') {
        receitas += t.valor ?? 0
        receitasCount++
      } else {
        despesas += t.valor ?? 0
        despesasCount++
      }
    }
    const saldo = receitas - despesas

    // ---------- Compute finance chart (6-month buckets) ----------
    const now = new Date()
    const months: { key: string; label: string; rec: number; dep: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'short' })
      months.push({ key, label, rec: 0, dep: 0 })
    }
    for (const t of transacoes) {
      const key = (t.data as string).slice(0, 7)
      const month = months.find((m) => m.key === key)
      if (!month) continue
      if (t.tipo === 'Receita') month.rec += t.valor ?? 0
      else month.dep += t.valor ?? 0
    }

    const financeChart = {
      labels: months.map((m) => m.label),
      receitas: months.map((m) => m.rec / 1000),
      despesas: months.map((m) => m.dep / 1000),
    }

    // ---------- Compute pipeline summary ----------
    const allLeads = leadsAllRes.data ?? []
    const pipelineSummary = KANBAN_COLUMNS.filter((c) => c.id !== 'Perdido').map((col) => {
      const colLeads = allLeads.filter((l) => l.status === col.id)
      const count = colLeads.length
      const total = colLeads.reduce((acc, l) => acc + ((l.valor_potencial as number) || 0), 0)
      return {
        id: col.id,
        label: col.label.replace(' ✓', ''),
        count,
        total,
        dot: col.dot,
      }
    })

    // ---------- Onboarding flag ----------
    const totalObras = obrasCountRes.count ?? 0
    const totalLeads = leadsCountRes.count ?? 0
    const showOnboarding = totalObras === 0 || totalLeads === 0

    // ---------- Response ----------
    return ok(request, {
      kpis: {
        obrasAtivas,
        receitas,
        despesas,
        saldo,
        leadsAtivos,
        compraPendenteCount,
        receitasCount,
        despesasCount,
      },
      financeChart,
      pipelineSummary,
      hotLeads: hotLeadsRes.data ?? [],
      topObras: topObrasRes.data ?? [],
      proximasVisitas: proximasVisitasRes.data ?? [],
      showOnboarding,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao calcular resumo do dashboard'
    log('error', 'dashboard.summary.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/dashboard/summary',
      error: message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message },
      500
    )
  }
}
