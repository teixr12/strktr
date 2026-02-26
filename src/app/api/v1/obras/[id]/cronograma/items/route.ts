import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { ensureCronogramaForObra } from '@/server/repositories/cronograma/cronograma-repository'
import { createCronogramaItemSchema } from '@/shared/schemas/cronograma-portal'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const parsed = createCronogramaItemSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }

  const { id: obraId } = await params
  const ensured = await ensureCronogramaForObra(supabase, { obraId, orgId, userId: user.id })
  if (ensured.error || !ensured.data) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: ensured.error?.message || 'Erro ao inicializar cronograma' },
      500
    )
  }

  const body = parsed.data
  const { data: created, error: createError } = await supabase
    .from('cronograma_itens')
    .insert({
      cronograma_id: ensured.data.id,
      org_id: orgId,
      obra_id: obraId,
      user_id: user.id,
      nome: body.nome,
      descricao: body.descricao || null,
      tipo: body.tipo,
      status: body.status,
      empresa_responsavel: body.empresa_responsavel || null,
      responsavel: body.responsavel || null,
      data_inicio_planejada: body.data_inicio_planejada || null,
      data_fim_planejada: body.data_fim_planejada || null,
      duracao_dias: body.duracao_dias,
      progresso: body.progresso ?? 0,
      ordem: body.ordem ?? 0,
      metadata: body.metadata || {},
    })
    .select('*')
    .single()

  if (createError || !created) {
    log('error', 'cronograma.items.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/cronograma/items',
      obraId,
      error: createError?.message || 'unknown',
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: createError?.message || 'Erro ao criar item' }, 400)
  }

  return ok(request, created, undefined, 201)
}
