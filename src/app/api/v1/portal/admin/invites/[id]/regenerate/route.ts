import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { sendNotificationEmail } from '@/lib/email/resend'
import { generatePortalToken, hashPortalToken } from '@/lib/portal/tokens'
import { emitProductEvent } from '@/lib/telemetry'
import { portalAdminRegenerateInviteSchema } from '@/shared/schemas/portal-admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  const { id: portalClienteId } = await params
  if (!portalClienteId || !UUID_REGEX.test(portalClienteId)) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'ID de cliente portal inválido' }, 400)
  }

  const parsed = portalAdminRegenerateInviteSchema.safeParse(await request.json().catch(() => ({})))
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

  const { data: portalCliente, error: portalClienteError } = await supabase
    .from('portal_clientes')
    .select('id, org_id, obra_id, nome, email, ativo')
    .eq('id', portalClienteId)
    .eq('org_id', orgId)
    .single()

  if (portalClienteError || !portalCliente) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Cliente do portal não encontrado' }, 404)
  }

  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id, nome')
    .eq('id', portalCliente.obra_id)
    .eq('org_id', orgId)
    .single()

  if (obraError || !obra) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const nowIso = new Date().toISOString()

  const { error: revokeError } = await supabase
    .from('portal_sessions')
    .update({ revoked_at: nowIso })
    .eq('org_id', orgId)
    .eq('portal_cliente_id', portalCliente.id)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)

  if (revokeError) {
    log('warn', 'portal.admin.regenerate.revoke_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/portal/admin/invites/[id]/regenerate',
      portalClienteId,
      error: revokeError.message,
    })
  }

  const rawToken = generatePortalToken()
  const tokenHash = hashPortalToken(rawToken)
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: session, error: sessionError } = await supabase
    .from('portal_sessions')
    .insert({
      org_id: orgId,
      obra_id: portalCliente.obra_id,
      portal_cliente_id: portalCliente.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select('id, expires_at')
    .single()

  if (sessionError || !session) {
    log('error', 'portal.admin.regenerate.session_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/portal/admin/invites/[id]/regenerate',
      portalClienteId,
      error: sessionError?.message || 'unknown',
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: sessionError?.message || 'Falha ao gerar nova sessão do portal' },
      500
    )
  }

  const origin = new URL(request.url).origin
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin
  const portalUrl = `${appUrl}/portal/${rawToken}`

  const emailSent = Boolean(
    await sendNotificationEmail(
      portalCliente.email,
      `Novo acesso ao Portal da Obra ${obra.nome}`,
      'Seu novo link de acesso ao portal está pronto',
      'Seu acesso anterior foi atualizado. Use este novo link seguro para acompanhar o andamento da obra.',
      portalUrl
    )
  )

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'portal_invite_sent',
    entityType: 'portal_invite',
    entityId: session.id,
    payload: {
      obraId: portalCliente.obra_id,
      portalClienteId: portalCliente.id,
      regenerated: true,
      emailSent,
      expiresAt: session.expires_at,
    },
    mirrorExternal: true,
  }).catch(() => undefined)

  return ok(
    request,
    {
      portalClienteId: portalCliente.id,
      sessionId: session.id,
      expiresAt: session.expires_at,
      portalUrl,
      emailSent,
    },
    { flag: 'NEXT_PUBLIC_FF_PORTAL_ADMIN_V1' },
    201
  )
}
