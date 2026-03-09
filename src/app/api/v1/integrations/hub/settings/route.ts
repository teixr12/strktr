import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import {
  getIntegrationsHubRuntimeStage,
  isIntegrationsHubWriteEnabled,
} from '@/lib/integrations-hub/feature'
import { withIntegrationsHubAuth } from '@/lib/integrations-hub/api'
import { integrationHubSettingsPatchSchema } from '@/shared/schemas/integrations-hub'
import type {
  IntegrationHubCode,
  IntegrationHubProviderSetting,
  IntegrationHubSettingsPayload,
} from '@/shared/types/integrations-hub'

const INTEGRATION_PROVIDER_SETTINGS_COLUMNS =
  'id, org_id, provider_code, enabled, status, rollout_mode, owner_email, callback_url, notes, created_at, updated_at'

const PROVIDER_CODES: IntegrationHubCode[] = [
  'whatsapp_business',
  'google_calendar',
  'resend',
  'posthog',
  'stripe',
  'mercadopago',
  'notion',
  'slack',
  'google_sheets',
  'webhooks',
  'sicoob_api',
]

function buildDefaultSettings(orgId: string): IntegrationHubProviderSetting[] {
  return PROVIDER_CODES.map((providerCode) => ({
    id: null,
    org_id: orgId,
    provider_code: providerCode,
    enabled: false,
    status: 'draft',
    rollout_mode: 'disabled',
    owner_email: null,
    callback_url: null,
    notes: null,
    created_at: null,
    updated_at: null,
  }))
}

export const GET = withIntegrationsHubAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { data, error } = await supabase
    .from('integration_provider_settings')
    .select(INTEGRATION_PROVIDER_SETTINGS_COLUMNS)
    .eq('org_id', orgId)
    .order('provider_code', { ascending: true })

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const existing = new Map<string, IntegrationHubProviderSetting>()
  for (const row of (data as IntegrationHubProviderSetting[] | null) || []) {
    existing.set(row.provider_code, row)
  }

  const settings = buildDefaultSettings(orgId).map((item) => existing.get(item.provider_code) || item)

  return ok(request, {
    settings,
    writeEnabled: isIntegrationsHubWriteEnabled(),
    runtimeStage: getIntegrationsHubRuntimeStage(),
  } satisfies IntegrationHubSettingsPayload)
})

export const PATCH = withIntegrationsHubAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  if (!isIntegrationsHubWriteEnabled()) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'Configuração write-capable do hub está bloqueada em produção. Use preview/staging.',
      },
      403
    )
  }

  const parsed = integrationHubSettingsPatchSchema.safeParse(await request.json().catch(() => null))
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

  const nowIso = new Date().toISOString()
  const updates: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: nowIso,
  }

  if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.rollout_mode !== undefined) updates.rollout_mode = parsed.data.rollout_mode
  if (parsed.data.owner_email !== undefined) updates.owner_email = parsed.data.owner_email
  if (parsed.data.callback_url !== undefined) updates.callback_url = parsed.data.callback_url
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

  const { data: existing, error: existingError } = await supabase
    .from('integration_provider_settings')
    .select('id')
    .eq('org_id', orgId)
    .eq('provider_code', parsed.data.provider_code)
    .maybeSingle()

  if (existingError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingError.message }, 500)
  }

  const mutation = existing?.id
    ? supabase
        .from('integration_provider_settings')
        .update(updates)
        .eq('id', existing.id)
        .eq('org_id', orgId)
        .select(INTEGRATION_PROVIDER_SETTINGS_COLUMNS)
        .single()
    : supabase
        .from('integration_provider_settings')
        .insert({
          org_id: orgId,
          provider_code: parsed.data.provider_code,
          created_by: user.id,
          ...updates,
        })
        .select(INTEGRATION_PROVIDER_SETTINGS_COLUMNS)
        .single()

  const { data, error } = await mutation

  if (error || !data) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao salvar configuração da integração' }, 500)
  }

  const { data: allRows, error: listError } = await supabase
    .from('integration_provider_settings')
    .select(INTEGRATION_PROVIDER_SETTINGS_COLUMNS)
    .eq('org_id', orgId)
    .order('provider_code', { ascending: true })

  if (listError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: listError.message }, 500)
  }

  const existingMap = new Map<string, IntegrationHubProviderSetting>()
  for (const row of (allRows as IntegrationHubProviderSetting[] | null) || []) {
    existingMap.set(row.provider_code, row)
  }

  const settings = buildDefaultSettings(orgId).map((item) => existingMap.get(item.provider_code) || item)

  return ok(request, {
    settings,
    writeEnabled: true,
    runtimeStage: getIntegrationsHubRuntimeStage(),
  } satisfies IntegrationHubSettingsPayload)
})
