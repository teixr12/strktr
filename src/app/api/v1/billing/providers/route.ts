import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withBillingAuth } from '@/lib/billing/api'
import { getBillingRuntimeStage, isBillingWriteEnabled } from '@/lib/billing/feature'
import { billingProviderSettingsPatchSchema } from '@/shared/schemas/billing'
import type {
  BillingProviderCode,
  BillingProviderSetting,
  BillingProviderSettingsPayload,
} from '@/shared/types/billing'

const BILLING_PROVIDER_COLUMNS =
  'id, org_id, provider_code, operational_status, rollout_mode, account_reference, publishable_key_hint, webhook_endpoint_hint, settlement_country, accepted_currencies, supports_pix, supports_cards, notes, created_at, updated_at'

const PROVIDER_DEFAULTS: Record<BillingProviderCode, Omit<BillingProviderSetting, 'id' | 'created_at' | 'updated_at'>> = {
  stripe: {
    org_id: '',
    provider_code: 'stripe',
    operational_status: 'planned',
    rollout_mode: 'internal',
    account_reference: null,
    publishable_key_hint: null,
    webhook_endpoint_hint: null,
    settlement_country: 'BR',
    accepted_currencies: ['BRL'],
    supports_pix: false,
    supports_cards: true,
    notes: null,
  },
  mercadopago: {
    org_id: '',
    provider_code: 'mercadopago',
    operational_status: 'planned',
    rollout_mode: 'internal',
    account_reference: null,
    publishable_key_hint: null,
    webhook_endpoint_hint: null,
    settlement_country: 'BR',
    accepted_currencies: ['BRL'],
    supports_pix: true,
    supports_cards: true,
    notes: null,
  },
}

function buildDefaultProviderSetting(orgId: string, providerCode: BillingProviderCode): BillingProviderSetting {
  return {
    id: null,
    ...PROVIDER_DEFAULTS[providerCode],
    org_id: orgId,
    created_at: null,
    updated_at: null,
  }
}

export const GET = withBillingAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { data, error } = await supabase
    .from('billing_provider_settings')
    .select(BILLING_PROVIDER_COLUMNS)
    .eq('org_id', orgId)

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const rows = ((data || []) as unknown) as BillingProviderSetting[]
  const rowByProvider = new Map(rows.map((item) => [item.provider_code, item]))
  const items = (['stripe', 'mercadopago'] as const).map((providerCode) => {
    return rowByProvider.get(providerCode) || buildDefaultProviderSetting(orgId, providerCode)
  })

  return ok(request, {
    items,
    writeEnabled: isBillingWriteEnabled(),
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingProviderSettingsPayload)
})

export const PATCH = withBillingAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  if (!isBillingWriteEnabled()) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'Configuração de provider de billing está bloqueada em produção. Use preview/staging.',
      },
      403
    )
  }

  const parsed = billingProviderSettingsPatchSchema.safeParse(await request.json().catch(() => null))
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

  const providerCode = parsed.data.provider_code
  const nowIso = new Date().toISOString()
  const updates: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: nowIso,
  }

  if (parsed.data.operational_status !== undefined) updates.operational_status = parsed.data.operational_status
  if (parsed.data.rollout_mode !== undefined) updates.rollout_mode = parsed.data.rollout_mode
  if (parsed.data.account_reference !== undefined) updates.account_reference = parsed.data.account_reference
  if (parsed.data.publishable_key_hint !== undefined) updates.publishable_key_hint = parsed.data.publishable_key_hint
  if (parsed.data.webhook_endpoint_hint !== undefined) updates.webhook_endpoint_hint = parsed.data.webhook_endpoint_hint
  if (parsed.data.settlement_country !== undefined) updates.settlement_country = parsed.data.settlement_country
  if (parsed.data.accepted_currencies !== undefined) {
    updates.accepted_currencies = parsed.data.accepted_currencies.map((value) => value.toUpperCase())
  }
  if (parsed.data.supports_pix !== undefined) updates.supports_pix = parsed.data.supports_pix
  if (parsed.data.supports_cards !== undefined) updates.supports_cards = parsed.data.supports_cards
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

  const { data: existing, error: existingError } = await supabase
    .from('billing_provider_settings')
    .select('id')
    .eq('org_id', orgId)
    .eq('provider_code', providerCode)
    .maybeSingle()

  if (existingError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingError.message }, 500)
  }

  const mutation = existing?.id
    ? supabase
        .from('billing_provider_settings')
        .update(updates)
        .eq('id', existing.id)
        .eq('org_id', orgId)
        .select(BILLING_PROVIDER_COLUMNS)
        .single()
    : supabase
        .from('billing_provider_settings')
        .insert({
          ...PROVIDER_DEFAULTS[providerCode],
          org_id: orgId,
          provider_code: providerCode,
          created_by: user.id,
          ...updates,
        })
        .select(BILLING_PROVIDER_COLUMNS)
        .single()

  const { data, error } = await mutation

  if (error || !data) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao salvar provider de billing' },
      500
    )
  }

  return ok(request, {
    items: [data as BillingProviderSetting],
    writeEnabled: true,
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingProviderSettingsPayload)
})
