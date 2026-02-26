import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { sendNotificationEmail } from '@/lib/email/resend'
import { generatePortalToken, hashPortalToken } from '@/lib/portal/tokens'
import { inviteClientPortalSchema } from '@/shared/schemas/cronograma-portal'

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

  const parsed = inviteClientPortalSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' },
      400
    )
  }

  const { id: obraId } = await params
  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id, nome')
    .eq('id', obraId)
    .eq('org_id', orgId)
    .single()

  if (obraError || !obra) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const body = parsed.data

  const existingClient = await supabase
    .from('portal_clientes')
    .select('id')
    .eq('org_id', orgId)
    .eq('obra_id', obraId)
    .eq('email', body.email)
    .maybeSingle()

  if (existingClient.error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingClient.error.message }, 400)
  }

  let portalClienteId = existingClient.data?.id || null

  if (!portalClienteId) {
    const { data: createdCliente, error: createClienteError } = await supabase
      .from('portal_clientes')
      .insert({
        org_id: orgId,
        obra_id: obraId,
        nome: body.nome,
        email: body.email,
        telefone: body.telefone || null,
        ativo: true,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (createClienteError || !createdCliente) {
      return fail(
        request,
        { code: API_ERROR_CODES.DB_ERROR, message: createClienteError?.message || 'Erro ao criar cliente portal' },
        400
      )
    }

    portalClienteId = createdCliente.id
  } else {
    await supabase
      .from('portal_clientes')
      .update({
        nome: body.nome,
        telefone: body.telefone || null,
        ativo: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', portalClienteId)
      .eq('org_id', orgId)
  }

  const rawToken = generatePortalToken()
  const tokenHash = hashPortalToken(rawToken)
  const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: session, error: sessionError } = await supabase
    .from('portal_sessions')
    .insert({
      org_id: orgId,
      obra_id: obraId,
      portal_cliente_id: portalClienteId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select('id, expires_at')
    .single()

  if (sessionError || !session) {
    log('error', 'portal.invite.session_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/obras/[id]/portal/invite',
      obraId,
      error: sessionError?.message || 'unknown',
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: sessionError?.message || 'Erro ao criar sessão do portal' },
      400
    )
  }

  const origin = new URL(request.url).origin
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin
  const portalUrl = `${appUrl}/portal/${rawToken}`

  const emailSent = Boolean(
    await sendNotificationEmail(
      body.email,
      `Acesso ao Portal da Obra ${obra.nome}`,
      'Seu portal do cliente está disponível',
      'Acompanhe cronograma, diário e aprovações da obra neste link seguro.',
      portalUrl
    )
  )

  return ok(
    request,
    {
      portalClienteId,
      sessionId: session.id,
      expiresAt: session.expires_at,
      portalUrl,
      emailSent,
    },
    { flag: 'NEXT_PUBLIC_FF_CLIENT_PORTAL' },
    201
  )
}
