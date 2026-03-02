import { withApiAuth } from '@/lib/api/with-auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { createKnowledgeItemSchema } from '@/shared/schemas/business'

export const GET = withApiAuth(null, async (request, { supabase, requestId, orgId, user }) => {
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
})

export const POST = withApiAuth('can_manage_projects', async (request, { supabase, requestId, orgId, user }) => {
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
      500
    )
  }

  return ok(request, data, undefined, 201)
})
