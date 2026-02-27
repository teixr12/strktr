import { getApiUser } from '@/lib/api/auth'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { obraFormSchema } from '@/shared/schemas/execution'
import { runAutomation } from '@/server/services/automation/automation-service'

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  let query = supabase
    .from('obras')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (status) query = query.eq('status', status)

  const { data, error: dbError } = await query
  if (dbError) {
    log('error', 'obras.get.failed', { requestId, orgId, userId: user.id, route: '/api/v1/obras', error: dbError.message })
    return fail(request, { code: 'DB_ERROR', message: dbError.message }, 500)
  }

  return ok(request, data ?? [], { count: data?.length || 0 })
}

export async function POST(request: Request) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }

  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const parsed = obraFormSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }
  const body = parsed.data

  const { data, error: dbError } = await supabase
    .from('obras')
    .insert({
      ...body,
      user_id: user.id,
      org_id: orgId,
      etapa_atual: body.etapa_atual || null,
      data_inicio: body.data_inicio || null,
      data_previsao: body.data_previsao || null,
      descricao: body.descricao || null,
    })
    .select()
    .single()

  if (dbError) {
    log('error', 'obras.create.failed', { requestId, orgId, userId: user.id, route: '/api/v1/obras', error: dbError.message })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  if (process.env.NEXT_PUBLIC_FF_SEMI_AUTOMATION !== 'false') {
    await runAutomation(
      supabase,
      {
        orgId,
        userId: user.id,
        trigger: 'ObraCreated',
        triggerEntityType: 'obra',
        triggerEntityId: data.id,
        payload: { status: data.status, etapaAtual: data.etapa_atual || null },
      },
      {
        confirm: false,
        source: 'trigger',
      }
    ).catch(() => undefined)
  }

  return ok(request, data, undefined, 201)
}
