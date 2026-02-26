import { getApiUser } from '@/lib/api/auth'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { fetchExecutionContext } from '@/server/repositories/obras/execution-repository'
import { buildExecutionSummary } from '@/server/services/obras/execution-summary-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: 'UNAUTHORIZED', message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: 'FORBIDDEN', message: 'Usuário sem organização ativa' }, 403)
  }

  const { id } = await params
  const { obraRes, etapasRes, checklistsRes, txRes, diarioRes } = await fetchExecutionContext(supabase, id, orgId)

  if (obraRes.error || !obraRes.data) {
    return fail(request, { code: 'NOT_FOUND', message: 'Obra não encontrada' }, 404)
  }

  if (etapasRes.error || checklistsRes.error || txRes.error || diarioRes.error) {
    log('error', 'obras.executionSummary.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/execution-summary',
      obraId: id,
      error:
        etapasRes.error?.message ||
        checklistsRes.error?.message ||
        txRes.error?.message ||
        diarioRes.error?.message,
    })
    return fail(request, { code: 'DB_ERROR', message: 'Falha ao montar resumo de execução' }, 500)
  }

  const summary = buildExecutionSummary({
    etapas: etapasRes.data ?? [],
    checklists: checklistsRes.data ?? [],
    transacoes: txRes.data ?? [],
    lastDiaryDate: diarioRes.data?.created_at || null,
  })

  return ok(request, { obra: obraRes.data, ...summary })
}
