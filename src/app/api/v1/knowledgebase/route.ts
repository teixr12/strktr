import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { createKnowledgeItemSchema } from '@/shared/schemas/business'

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const categoria = searchParams.get('categoria')
  const onlyActive = searchParams.get('ativo') !== 'false'
  const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500)

  let query = supabase
    .from('knowledgebase')
    .select('*')
    .eq('org_id', orgId)
    .order('categoria')
    .order('titulo')
    .limit(limit)
  if (onlyActive) query = query.eq('ativo', true)
  if (categoria) query = query.eq('categoria', categoria)

  const { data, error: dbError } = await query
  if (dbError) {
    log('error', 'knowledgebase.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/knowledgebase',
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      500
    )
  }

  return ok(request, data ?? [], { count: data?.length || 0 })
}

export async function POST(request: Request) {
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

  const parsed = createKnowledgeItemSchema.safeParse(await request.json())
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
  const { data, error: dbError } = await supabase
    .from('knowledgebase')
    .insert({
      user_id: user.id,
      org_id: orgId,
      categoria: body.categoria,
      titulo: body.titulo,
      conteudo: body.conteudo || null,
      unidade: body.unidade || null,
      valor_referencia: body.valor_referencia || null,
      tags: body.tags || [],
      ativo: body.ativo ?? true,
    })
    .select()
    .single()

  if (dbError) {
    log('error', 'knowledgebase.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/knowledgebase',
      error: dbError.message,
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError.message },
      400
    )
  }

  return ok(request, data, undefined, 201)
}
