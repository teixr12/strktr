import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { fetchExecutionContext } from '@/server/repositories/obras/execution-repository'
import { buildExecutionSummary } from '@/server/services/obras/execution-summary-service'
import type { ObraKpisPayload } from '@/shared/types/obra-kpis'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  const { obraRes, etapasRes, checklistsRes, txRes, diarioRes } = await fetchExecutionContext(
    supabase,
    id,
    orgId
  )

  if (obraRes.error || !obraRes.data) {
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' },
      404
    )
  }

  if (etapasRes.error || checklistsRes.error || txRes.error || diarioRes.error) {
    log('error', 'obras.kpis.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/kpis',
      obraId: id,
      error:
        etapasRes.error?.message ||
        checklistsRes.error?.message ||
        txRes.error?.message ||
        diarioRes.error?.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: 'Falha ao montar KPIs da obra' },
      500
    )
  }

  const summary = buildExecutionSummary({
    etapas: etapasRes.data ?? [],
    checklists: checklistsRes.data ?? [],
    transacoes: txRes.data ?? [],
    lastDiaryDate: diarioRes.data?.created_at || null,
  })

  const payload: ObraKpisPayload = {
    obra: {
      id: obraRes.data.id,
      nome: obraRes.data.nome,
      cliente: obraRes.data.cliente,
      status: obraRes.data.status,
      progresso: obraRes.data.progresso,
      data_previsao: obraRes.data.data_previsao,
    },
    kpis: summary.kpis,
    risk: summary.risk,
    generatedAt: new Date().toISOString(),
  }

  return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_OBRA_KPI_V1' })
}
