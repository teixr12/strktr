import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withBillingAuth } from '@/lib/billing/api'
import { getBillingRuntimeStage, isBillingWriteEnabled } from '@/lib/billing/feature'
import { billingAdminSettingsPatchSchema } from '@/shared/schemas/billing'
import type { BillingAdminSettings, BillingAdminSettingsPayload } from '@/shared/types/billing'

const BILLING_SETTINGS_COLUMNS =
  'id, org_id, default_provider, billing_email, support_email, terms_url, privacy_url, checkout_enabled, sandbox_mode, trial_days, monthly_price_cents, annual_price_cents, created_at, updated_at'

function buildDefaultSettings(orgId: string): BillingAdminSettings {
  return {
    id: null,
    org_id: orgId,
    default_provider: 'stripe',
    billing_email: null,
    support_email: null,
    terms_url: null,
    privacy_url: null,
    checkout_enabled: false,
    sandbox_mode: true,
    trial_days: 14,
    monthly_price_cents: null,
    annual_price_cents: null,
    created_at: null,
    updated_at: null,
  }
}

export const GET = withBillingAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { data, error } = await supabase
    .from('billing_admin_settings')
    .select(BILLING_SETTINGS_COLUMNS)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, {
    settings: (data as BillingAdminSettings | null) || buildDefaultSettings(orgId),
    writeEnabled: isBillingWriteEnabled(),
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingAdminSettingsPayload)
})

export const PATCH = withBillingAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  if (!isBillingWriteEnabled()) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'Billing write-capable está bloqueado em produção. Use preview/staging.',
      },
      403
    )
  }

  const parsed = billingAdminSettingsPatchSchema.safeParse(await request.json().catch(() => null))
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

  if (parsed.data.default_provider !== undefined) updates.default_provider = parsed.data.default_provider
  if (parsed.data.billing_email !== undefined) updates.billing_email = parsed.data.billing_email
  if (parsed.data.support_email !== undefined) updates.support_email = parsed.data.support_email
  if (parsed.data.terms_url !== undefined) updates.terms_url = parsed.data.terms_url
  if (parsed.data.privacy_url !== undefined) updates.privacy_url = parsed.data.privacy_url
  if (parsed.data.checkout_enabled !== undefined) updates.checkout_enabled = parsed.data.checkout_enabled
  if (parsed.data.sandbox_mode !== undefined) updates.sandbox_mode = parsed.data.sandbox_mode
  if (parsed.data.trial_days !== undefined) updates.trial_days = parsed.data.trial_days
  if (parsed.data.monthly_price_cents !== undefined) updates.monthly_price_cents = parsed.data.monthly_price_cents
  if (parsed.data.annual_price_cents !== undefined) updates.annual_price_cents = parsed.data.annual_price_cents

  const { data: existing, error: existingError } = await supabase
    .from('billing_admin_settings')
    .select('id')
    .eq('org_id', orgId)
    .maybeSingle()

  if (existingError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingError.message }, 500)
  }

  const mutation = existing?.id
    ? supabase
        .from('billing_admin_settings')
        .update(updates)
        .eq('id', existing.id)
        .eq('org_id', orgId)
        .select(BILLING_SETTINGS_COLUMNS)
        .single()
    : supabase
        .from('billing_admin_settings')
        .insert({
          org_id: orgId,
          created_by: user.id,
          ...updates,
        })
        .select(BILLING_SETTINGS_COLUMNS)
        .single()

  const { data, error } = await mutation

  if (error || !data) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao salvar billing' }, 500)
  }

  return ok(request, {
    settings: data as BillingAdminSettings,
    writeEnabled: true,
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingAdminSettingsPayload)
})
