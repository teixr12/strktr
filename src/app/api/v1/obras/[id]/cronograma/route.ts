import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { ensureCronogramaForObra } from '@/server/repositories/cronograma/cronograma-repository'
import { recalculateSchedule } from '@/server/services/cronograma/schedule-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const { id: obraId } = await params
  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id, nome')
    .eq('id', obraId)
    .eq('org_id', orgId)
    .single()

  if (obraError || !obra) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const ensured = await ensureCronogramaForObra(supabase, {
    obraId,
    orgId,
    userId: user.id,
  })
  if (ensured.error || !ensured.data) {
    log('error', 'cronograma.ensure.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/cronograma',
      obraId,
      error: ensured.error?.message || 'unknown',
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: ensured.error?.message || 'Erro ao inicializar cronograma' },
      500
    )
  }

  const cronogramaId = ensured.data.id

  const [cronogramaRes, itensRes, depsRes, baselineRes] = await Promise.all([
    supabase
      .from('cronograma_obras')
      .select('*')
      .eq('id', cronogramaId)
      .eq('org_id', orgId)
      .single(),
    supabase
      .from('cronograma_itens')
      .select('*')
      .eq('cronograma_id', cronogramaId)
      .eq('org_id', orgId)
      .order('ordem', { ascending: true }),
    supabase
      .from('cronograma_dependencias')
      .select('*')
      .eq('cronograma_id', cronogramaId)
      .eq('org_id', orgId),
    supabase
      .from('cronograma_baselines')
      .select('*')
      .eq('cronograma_id', cronogramaId)
      .eq('org_id', orgId)
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (cronogramaRes.error || itensRes.error || depsRes.error) {
    log('error', 'cronograma.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/cronograma',
      obraId,
      error: cronogramaRes.error?.message || itensRes.error?.message || depsRes.error?.message || 'unknown',
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: 'Erro ao carregar cronograma' }, 500)
  }

  const schedule = recalculateSchedule(itensRes.data || [], depsRes.data || [])
  return ok(request, {
    obra,
    cronograma: cronogramaRes.data,
    itens: itensRes.data || [],
    dependencias: depsRes.data || [],
    baselineAtual: baselineRes.data || null,
    summary: schedule.summary,
  }, { flag: 'NEXT_PUBLIC_FF_CRONOGRAMA_ENGINE' })
}
