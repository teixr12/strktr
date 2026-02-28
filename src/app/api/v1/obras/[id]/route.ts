import { getApiUser } from '@/lib/api/auth'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { obraFormSchema } from '@/shared/schemas/execution'

function isSupabaseNotFound(error: { code?: string } | null | undefined) {
  return error?.code === 'PGRST116'
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)

  const { id } = await params
  const { data, error: dbError } = await supabase.from('obras').select('*').eq('id', id).eq('org_id', orgId).single()
  if (dbError) {
    if (isSupabaseNotFound(dbError)) {
      log('warn', 'obras.getById.not_found', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/obras/[id]',
        obraId: id,
      })
      return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
    }
    log('error', 'obras.getById.failed', { requestId, orgId, userId: user.id, route: '/api/v1/obras/[id]', error: dbError.message, obraId: id })
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  return ok(request, data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)

  const { id } = await params
  const parsed = obraFormSchema.partial().safeParse(await request.json())
  if (!parsed.success) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' }, 400)
  }
  const body = parsed.data

  const { data, error: dbError } = await supabase
    .from('obras')
    .update({
      ...body,
      area_m2: body.area_m2 ?? null,
      etapa_atual: body.etapa_atual || null,
      data_inicio: body.data_inicio || null,
      data_previsao: body.data_previsao || null,
      descricao: body.descricao || null,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()
  if (dbError) {
    if (isSupabaseNotFound(dbError)) {
      log('warn', 'obras.update.not_found', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/obras/[id]',
        obraId: id,
      })
      return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
    }
    log('error', 'obras.update.failed', { requestId, orgId, userId: user.id, route: '/api/v1/obras/[id]', error: dbError.message, obraId: id })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: 'Falha ao atualizar obra' }, 400)
  }

  return ok(request, data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  if (!orgId) return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)

  const { id } = await params
  const { error: dbError } = await supabase.from('obras').delete().eq('id', id).eq('org_id', orgId)
  if (dbError) {
    log('error', 'obras.delete.failed', { requestId, orgId, userId: user.id, route: '/api/v1/obras/[id]', error: dbError.message, obraId: id })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  return ok(request, { success: true })
}
