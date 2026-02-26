import { getApiUser } from '@/lib/api/auth'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { requireExecutionPermission } from '@/lib/auth/execution-permissions'
import { createDiarioNoteSchema } from '@/shared/schemas/execution'

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
  const permissionError = requireExecutionPermission(request, role, 'can_add_diary')
  if (permissionError) return permissionError

  const { id } = await params
  const parsed = createDiarioNoteSchema.safeParse(await request.json())
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
  const payload = parsed.data

  const { data: obra } = await supabase
    .from('obras')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!obra) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const { data, error: insertError } = await supabase
    .from('diario_obra')
    .insert({
      obra_id: id,
      user_id: user.id,
      org_id: orgId,
      tipo: 'nota',
      titulo: payload.titulo.trim(),
      descricao: payload.descricao.trim(),
      metadata: {},
    })
    .select('*')
    .single()

  if (insertError) {
    log('error', 'obras.diario.note.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/diario/notes',
      obraId: id,
      error: insertError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: insertError.message }, 400)
  }

  return ok(request, data, undefined, 201)
}
