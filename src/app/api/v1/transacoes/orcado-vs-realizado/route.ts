import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { emitProductEvent } from '@/lib/telemetry'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'

interface ObraResumo {
  obraId: string
  nome: string
  valorOrcado: number
  valorRealizado: number
  desvio: number
  desvioPct: number
  thresholdPct: number
  isCritical: boolean
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
  const obraId = searchParams.get('obra_id')
  const thresholdPct = Math.max(
    1,
    Math.min(parseFloat(searchParams.get('thresholdPct') || '10'), 100)
  )

  let obrasQuery = supabase
    .from('obras')
    .select('id, nome, valor_contrato, valor_gasto')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (obraId) {
    obrasQuery = obrasQuery.eq('id', obraId)
  }

  const { data: obras, error: obrasError } = await obrasQuery
  if (obrasError) {
    log('error', 'financeiro.orcado_realizado.obras_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/transacoes/orcado-vs-realizado',
      error: obrasError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: obrasError.message },
      500
    )
  }

  const obraIds = (obras || []).map((o) => o.id)
  if (obraIds.length === 0) {
    return ok(request, { summary: [], totals: { totalObras: 0, totalCritical: 0 } })
  }

  const { data: transacoes, error: txError } = await supabase
    .from('transacoes')
    .select('obra_id, tipo, valor')
    .eq('org_id', orgId)
    .in('obra_id', obraIds)

  if (txError) {
    log('error', 'financeiro.orcado_realizado.transacoes_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/transacoes/orcado-vs-realizado',
      error: txError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: txError.message },
      500
    )
  }

  const despesasByObra = new Map<string, number>()
  for (const tx of transacoes || []) {
    if (!tx.obra_id || tx.tipo !== 'Despesa') continue
    despesasByObra.set(tx.obra_id, (despesasByObra.get(tx.obra_id) || 0) + Number(tx.valor || 0))
  }

  const summary: ObraResumo[] = (obras || []).map((obra) => {
    const valorOrcado = Number(obra.valor_gasto || 0)
    const valorRealizado = despesasByObra.get(obra.id) || 0
    const desvio = valorRealizado - valorOrcado
    const desvioPct = valorOrcado > 0 ? (desvio / valorOrcado) * 100 : valorRealizado > 0 ? 100 : 0
    const isCritical = desvioPct >= thresholdPct
    return {
      obraId: obra.id,
      nome: obra.nome,
      valorOrcado,
      valorRealizado,
      desvio,
      desvioPct: Number(desvioPct.toFixed(2)),
      thresholdPct,
      isCritical,
    }
  })

  const critical = summary.filter((obra) => obra.isCritical)
  if (critical.length > 0) {
    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'BudgetDeviationDetected',
      entityType: 'obra',
      entityId: critical[0].obraId,
      payload: {
        thresholdPct,
        totalCritical: critical.length,
      },
    }).catch(() => undefined)
  }

  return ok(request, {
    summary,
    totals: {
      totalObras: summary.length,
      totalCritical: critical.length,
    },
  })
}
