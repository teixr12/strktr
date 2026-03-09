import { ok, fail } from '@/lib/api/response'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { withFinanceDepthAuth } from '@/lib/finance-depth/api'
import { log } from '@/lib/api/logger'
import type { FinanceDepthAlert, FinanceDepthPayload } from '@/shared/types/finance-depth'

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export const GET = withFinanceDepthAuth('can_manage_finance', async (request, { supabase, orgId, requestId, user }) => {
  const { searchParams } = new URL(request.url)
  const monthsRequested = Number.parseInt(searchParams.get('months') || '6', 10)
  const months = Math.max(3, Math.min(Number.isFinite(monthsRequested) ? monthsRequested : 6, 12))

  const now = new Date()
  const monthBuckets = Array.from({ length: months }).map((_, index) => {
    const pointDate = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1)
    return {
      month: monthKey(pointDate),
      label: monthLabel(pointDate),
      receitas: 0,
      despesas: 0,
      saldo: 0,
    }
  })

  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).toISOString().slice(0, 10)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('transacoes')
    .select('tipo, valor, data, categoria')
    .eq('org_id', orgId)
    .gte('data', start)
    .lte('data', end)

  if (error) {
    log('error', 'financeiro.dre.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/financeiro/dre',
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const byCategory = new Map<string, { total: number; count: number }>()
  let receitas = 0
  let despesas = 0

  for (const tx of data || []) {
    const bucket = monthBuckets.find((item) => item.month === String(tx.data).slice(0, 7))
    const value = Number(tx.valor || 0)
    if (tx.tipo === 'Receita') {
      receitas += value
      if (bucket) bucket.receitas += value
    } else {
      despesas += value
      if (bucket) bucket.despesas += value
      const category = (tx.categoria || 'Sem categoria').trim() || 'Sem categoria'
      const current = byCategory.get(category) || { total: 0, count: 0 }
      current.total += value
      current.count += 1
      byCategory.set(category, current)
    }
  }

  for (const bucket of monthBuckets) {
    bucket.saldo = bucket.receitas - bucket.despesas
  }

  const saldo = receitas - despesas
  const negativeMonths = monthBuckets.filter((item) => item.saldo < 0).length
  const alerts: FinanceDepthAlert[] = []

  if (saldo < 0) {
    alerts.push({
      code: 'FINANCE_NET_NEGATIVE',
      title: 'Fluxo líquido negativo no período',
      severity: 'high',
      message: 'Despesas totais superaram receitas no período analisado.',
    })
  } else if (negativeMonths > 0) {
    alerts.push({
      code: 'FINANCE_NEGATIVE_MONTHS',
      title: 'Meses com saldo negativo',
      severity: negativeMonths >= 2 ? 'medium' : 'low',
      message: `${negativeMonths} mês(es) fecharam com saldo líquido negativo.`,
    })
  }

  const payload: FinanceDepthPayload = {
    summary: {
      receitas,
      despesas,
      saldo,
      averageMonthlyNet: monthBuckets.length > 0 ? saldo / monthBuckets.length : 0,
      negativeMonths,
      monthsAnalyzed: monthBuckets.length,
    },
    monthly: monthBuckets,
    topExpenseCategories: Array.from(byCategory.entries())
      .map(([categoria, value]) => ({
        categoria,
        total: value.total,
        count: value.count,
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 5),
    alerts,
    generatedAt: new Date().toISOString(),
  }

  return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_FINANCE_DEPTH_V1' })
})
