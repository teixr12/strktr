import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateKnowledgeItemSchema } from '@/shared/schemas/business'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, orgId } = await getApiUser(request)
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
  const { data, error: dbError } = await supabase
    .from('knowledgebase')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (dbError) {
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: dbError.message },
      404
    )
  }

  return ok(request, data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const parsed = updateKnowledgeItemSchema.safeParse(await request.json())
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
  const body = parsed.data
  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('knowledgebase')
    .update({
      categoria: body.categoria,
      titulo: body.titulo,
      conteudo: body.conteudo === undefined ? undefined : body.conteudo || null,
      unidade: body.unidade === undefined ? undefined : body.unidade || null,
      valor_referencia:
        body.valor_referencia === undefined ? undefined : body.valor_referencia || null,
      tags: body.tags,
      ativo: body.ativo,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (dbError) {
    log('error', 'knowledgebase.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/knowledgebase/[id]',
      itemId: id,
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      500
    )
  }

  return ok(request, data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const { id } = await params
  const { error: dbError } = await supabase
    .from('knowledgebase')
    .update({ ativo: false })
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbError) {
    log('error', 'knowledgebase.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/knowledgebase/[id]',
      itemId: id,
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      500
    )
  }

  return ok(request, { success: true })
}
