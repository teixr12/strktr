import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { completeRoadmapActionSchema } from '@/shared/schemas/roadmap-automation'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }

  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const parsed = completeRoadmapActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message || 'Payload inválido',
      },
      400
    )
  }

  const { id } = await params
  const status = parsed.data.status
  const nowIso = new Date().toISOString()

  const { data: updated, error: updateError } = await supabase
    .from('roadmap_actions')
    .update({
      status,
      completed_at: status === 'completed' ? nowIso : null,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (updateError || !updated) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Ação de roadmap não encontrada para este usuário',
      },
      404
    )
  }

  return ok(request, updated, { flag: 'NEXT_PUBLIC_FF_PERSONAL_ROADMAP' })
}
