import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { emitProductEvent } from '@/lib/telemetry'
import { portalAdminSettingsPatchSchema } from '@/shared/schemas/portal-admin'
import type { PortalAdminClient, PortalAdminSessionSummary, PortalAdminSettings } from '@/shared/types/portal-admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function resolveObraIdFromQuery(request: Request): string | null {
  const { searchParams } = new URL(request.url)
  const obraId = searchParams.get('obra_id')?.trim() || ''
  if (!obraId || !UUID_REGEX.test(obraId)) return null
  return obraId
}

function toPortalSessionStatus(session: PortalAdminSessionSummary | null): PortalAdminSessionSummary['status'] {
  if (!session) return 'none'
  if (session.revoked_at) return 'revoked'
  const expiresAtTs = new Date(session.expires_at).getTime()
  if (Number.isFinite(expiresAtTs) && expiresAtTs < Date.now()) return 'expired'
  return 'active'
}

const SETTINGS_COLUMNS =
  'id, org_id, obra_id, branding_nome, branding_logo_url, branding_cor_primaria, mensagem_boas_vindas, notificar_por_email, created_at, updated_at'

function buildDefaultSettings(orgId: string, obraId: string): PortalAdminSettings {
  return {
    id: null,
    org_id: orgId,
    obra_id: obraId,
    branding_nome: null,
    branding_logo_url: null,
    branding_cor_primaria: '#D4A574',
    mensagem_boas_vindas: null,
    notificar_por_email: true,
    created_at: null,
    updated_at: null,
  }
}

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const obraId = resolveObraIdFromQuery(request)
  if (!obraId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'obra_id inválido' }, 400)
  }

  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id, nome, cliente, status')
    .eq('id', obraId)
    .eq('org_id', orgId)
    .single()

  if (obraError || !obra) {
    log('warn', 'portal.admin.settings.obra_not_found', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/portal/admin/settings',
      obraId,
    })
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const { data: settingsData, error: settingsError } = await supabase
    .from('portal_admin_settings')
    .select(SETTINGS_COLUMNS)
    .eq('org_id', orgId)
    .eq('obra_id', obraId)
    .maybeSingle()

  if (settingsError) {
    log('error', 'portal.admin.settings.get_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/portal/admin/settings',
      obraId,
      error: settingsError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: settingsError.message }, 500)
  }

  const { data: clientsData, error: clientsError } = await supabase
    .from('portal_clientes')
    .select('id, nome, email, telefone, ativo, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('obra_id', obraId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (clientsError) {
    log('error', 'portal.admin.settings.clients_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/portal/admin/settings',
      obraId,
      error: clientsError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: clientsError.message }, 500)
  }

  const clientIds = (clientsData || []).map((client) => client.id)
  const latestSessionByClient = new Map<string, PortalAdminSessionSummary>()

  if (clientIds.length > 0) {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('portal_sessions')
      .select('id, portal_cliente_id, expires_at, revoked_at, created_at, last_accessed_at')
      .eq('org_id', orgId)
      .in('portal_cliente_id', clientIds)
      .order('created_at', { ascending: false })
      .limit(500)

    if (sessionsError) {
      log('error', 'portal.admin.settings.sessions_failed', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/portal/admin/settings',
        obraId,
        error: sessionsError.message,
      })
      return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: sessionsError.message }, 500)
    }

    for (const session of sessionsData || []) {
      if (latestSessionByClient.has(session.portal_cliente_id)) continue
      const summary: PortalAdminSessionSummary = {
        id: session.id,
        status: 'none',
        expires_at: session.expires_at,
        revoked_at: session.revoked_at,
        created_at: session.created_at,
        last_accessed_at: session.last_accessed_at,
      }
      summary.status = toPortalSessionStatus(summary)
      latestSessionByClient.set(session.portal_cliente_id, summary)
    }
  }

  const clients: PortalAdminClient[] = (clientsData || []).map((client) => ({
    ...client,
    latest_session: latestSessionByClient.get(client.id) || null,
  }))

  return ok(
    request,
    {
      obra,
      settings: (settingsData as PortalAdminSettings | null) || buildDefaultSettings(orgId, obraId),
      clients,
    },
    { flag: 'NEXT_PUBLIC_FF_PORTAL_ADMIN_V1' }
  )
}

export async function PATCH(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const obraId = resolveObraIdFromQuery(request)
  if (!obraId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'obra_id inválido' }, 400)
  }

  const parsed = portalAdminSettingsPatchSchema.safeParse(await request.json().catch(() => null))
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

  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id')
    .eq('id', obraId)
    .eq('org_id', orgId)
    .single()

  if (obraError || !obra) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const { data: existingSettings, error: existingSettingsError } = await supabase
    .from('portal_admin_settings')
    .select('id')
    .eq('org_id', orgId)
    .eq('obra_id', obraId)
    .maybeSingle()

  if (existingSettingsError) {
    log('error', 'portal.admin.settings.lookup_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/portal/admin/settings',
      obraId,
      error: existingSettingsError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingSettingsError.message }, 500)
  }

  const nowIso = new Date().toISOString()
  const updates: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: nowIso,
  }

  if (parsed.data.branding_nome !== undefined) updates.branding_nome = parsed.data.branding_nome
  if (parsed.data.branding_logo_url !== undefined) updates.branding_logo_url = parsed.data.branding_logo_url
  if (parsed.data.branding_cor_primaria !== undefined) updates.branding_cor_primaria = parsed.data.branding_cor_primaria
  if (parsed.data.mensagem_boas_vindas !== undefined) updates.mensagem_boas_vindas = parsed.data.mensagem_boas_vindas
  if (parsed.data.notificar_por_email !== undefined) updates.notificar_por_email = parsed.data.notificar_por_email

  const mutation = existingSettings?.id
    ? supabase
        .from('portal_admin_settings')
        .update(updates)
        .eq('id', existingSettings.id)
        .eq('org_id', orgId)
        .select(SETTINGS_COLUMNS)
        .single()
    : supabase
        .from('portal_admin_settings')
        .insert({
          org_id: orgId,
          obra_id: obraId,
          created_by: user.id,
          ...updates,
        })
        .select(SETTINGS_COLUMNS)
        .single()

  const { data: updatedSettings, error: updateError } = await mutation

  if (updateError || !updatedSettings) {
    log('error', 'portal.admin.settings.patch_failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/portal/admin/settings',
      obraId,
      error: updateError?.message || 'unknown',
    })
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: updateError?.message || 'Falha ao atualizar configuração do portal' },
      500
    )
  }

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'portal_admin_updated',
    entityType: 'portal_admin_settings',
    entityId: updatedSettings.id,
    payload: { obraId },
    mirrorExternal: true,
  }).catch(() => undefined)

  return ok(
    request,
    { settings: updatedSettings as PortalAdminSettings },
    { flag: 'NEXT_PUBLIC_FF_PORTAL_ADMIN_V1' }
  )
}
