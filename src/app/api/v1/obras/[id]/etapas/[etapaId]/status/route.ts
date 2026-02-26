import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { emitProductEvent } from '@/lib/telemetry'
import { requireExecutionPermission } from '@/lib/auth/execution-permissions'
import { updateEtapaStatusSchema } from '@/shared/schemas/execution'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; etapaId: string }> }
) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireExecutionPermission(request, role, 'can_update_stage')
  if (permissionError) return permissionError

  const { id, etapaId } = await params
  const parsed = updateEtapaStatusSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message || 'Payload inválido: status é obrigatório e deve ser válido',
      },
      400
    )
  }
  const payload = parsed.data

  const { data: etapa } = await supabase
    .from('obra_etapas')
    .select('id, nome, obra_id')
    .eq('id', etapaId)
    .eq('obra_id', id)
    .eq('org_id', orgId)
    .single()

  if (!etapa) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Etapa não encontrada' }, 404)
  }

  const { data, error: updateError } = await supabase
    .from('obra_etapas')
    .update({ status: payload.status })
    .eq('id', etapaId)
    .select('*')
    .single()

  if (updateError) {
    log('error', 'obras.etapa.status.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/etapas/[etapaId]/status',
      obraId: id,
      etapaId,
      error: updateError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: updateError.message }, 400)
  }

  await supabase.from('diario_obra').insert({
    obra_id: id,
    user_id: user.id,
    org_id: orgId,
    tipo: 'etapa_change',
    titulo: `Etapa atualizada: ${etapa.nome}`,
    descricao: `Status alterado para ${payload.status}`,
    metadata: { etapaId, status: payload.status },
  })

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'EtapaStatusChanged',
    entityType: 'obra_etapa',
    entityId: etapaId,
    payload: { obraId: id, status: payload.status },
  }).catch(() => undefined)

  return ok(request, data)
}
