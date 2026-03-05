import { withApiAuth } from '@/lib/api/with-auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { createMembroSchema } from '@/shared/schemas/business'

const EQUIPE_SELECT_FIELDS = [
  'id',
  'user_id',
  'org_id',
  'nome',
  'cargo',
  'telefone',
  'email',
  'especialidade',
  'status',
  'obras_ids',
  'avaliacao',
  'valor_hora',
  'notas',
  'avatar_url',
  'created_at',
].join(', ')

export const GET = withApiAuth('can_manage_team', async (request, { supabase, requestId, orgId, user }) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200)

  let query = supabase
    .from('equipe')
    .select(EQUIPE_SELECT_FIELDS)
    .eq('org_id', orgId)
    .order('nome')
    .limit(limit)
  if (status) query = query.eq('status', status)

  const { data, error: dbError } = await query
  if (dbError) {
    log('error', 'equipe.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/equipe',
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

export const POST = withApiAuth('can_manage_team', async (request, { supabase, requestId, orgId, user }) => {
  const parsed = createMembroSchema.safeParse(await request.json())
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
    .from('equipe')
    .insert({
      user_id: user.id,
      org_id: orgId,
      nome: body.nome,
      cargo: body.cargo,
      telefone: body.telefone || null,
      email: body.email || null,
      especialidade: body.especialidade || null,
      status: body.status,
      avaliacao: body.avaliacao,
      valor_hora: body.valor_hora || null,
      notas: body.notas || null,
      avatar_url: body.avatar_url || null,
      obras_ids: body.obras_ids || [],
    })
    .select()
    .single()

  if (dbError) {
    log('error', 'equipe.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/equipe',
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
