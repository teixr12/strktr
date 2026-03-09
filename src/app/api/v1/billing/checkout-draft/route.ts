import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withBillingAuth } from '@/lib/billing/api'
import { getBillingRuntimeStage, isBillingWriteEnabled } from '@/lib/billing/feature'
import { billingCheckoutDraftPatchSchema } from '@/shared/schemas/billing'
import type { BillingCheckoutDraft, BillingCheckoutDraftPayload } from '@/shared/types/billing'

const BILLING_CHECKOUT_DRAFT_COLUMNS =
  'id, org_id, plan_slug, headline, subheadline, currency, monthly_price_cents, annual_price_cents, trial_days_override, primary_cta_label, accepted_providers, feature_bullets, mode, notes, created_at, updated_at'

function buildDefaultDraft(orgId: string): BillingCheckoutDraft {
  return {
    id: null,
    org_id: orgId,
    plan_slug: 'strktr-pro',
    headline: 'Plano PRO para operação, CRM e financeiro da construtora',
    subheadline: 'Checkout sandbox interno para validar copy, pricing e superfície de conversão sem abrir cobrança real.',
    currency: 'BRL',
    monthly_price_cents: null,
    annual_price_cents: null,
    trial_days_override: 14,
    primary_cta_label: 'Iniciar sandbox',
    accepted_providers: ['stripe'],
    feature_bullets: [
      'CRM, obras e financeiro na mesma operação',
      'Portal do cliente e documentos unificados',
      'Alertas operacionais e visão first-fold por obra',
    ],
    mode: 'disabled',
    notes: null,
    created_at: null,
    updated_at: null,
  }
}

export const GET = withBillingAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { data, error } = await supabase
    .from('billing_checkout_drafts')
    .select(BILLING_CHECKOUT_DRAFT_COLUMNS)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, {
    draft: (data as BillingCheckoutDraft | null) || buildDefaultDraft(orgId),
    writeEnabled: isBillingWriteEnabled(),
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingCheckoutDraftPayload)
})

export const PATCH = withBillingAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  if (!isBillingWriteEnabled()) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'Checkout draft write-capable está bloqueado em produção. Use preview/staging.',
      },
      403
    )
  }

  const parsed = billingCheckoutDraftPatchSchema.safeParse(await request.json().catch(() => null))
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

  if (parsed.data.plan_slug !== undefined) updates.plan_slug = parsed.data.plan_slug
  if (parsed.data.headline !== undefined) updates.headline = parsed.data.headline
  if (parsed.data.subheadline !== undefined) updates.subheadline = parsed.data.subheadline
  if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency.toUpperCase()
  if (parsed.data.monthly_price_cents !== undefined) updates.monthly_price_cents = parsed.data.monthly_price_cents
  if (parsed.data.annual_price_cents !== undefined) updates.annual_price_cents = parsed.data.annual_price_cents
  if (parsed.data.trial_days_override !== undefined) updates.trial_days_override = parsed.data.trial_days_override
  if (parsed.data.primary_cta_label !== undefined) updates.primary_cta_label = parsed.data.primary_cta_label
  if (parsed.data.accepted_providers !== undefined) updates.accepted_providers = parsed.data.accepted_providers
  if (parsed.data.feature_bullets !== undefined) updates.feature_bullets = parsed.data.feature_bullets
  if (parsed.data.mode !== undefined) updates.mode = parsed.data.mode
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

  const { data: existing, error: existingError } = await supabase
    .from('billing_checkout_drafts')
    .select('id')
    .eq('org_id', orgId)
    .maybeSingle()

  if (existingError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingError.message }, 500)
  }

  const mutation = existing?.id
    ? supabase
        .from('billing_checkout_drafts')
        .update(updates)
        .eq('id', existing.id)
        .eq('org_id', orgId)
        .select(BILLING_CHECKOUT_DRAFT_COLUMNS)
        .single()
    : supabase
        .from('billing_checkout_drafts')
        .insert({
          org_id: orgId,
          created_by: user.id,
          ...updates,
        })
        .select(BILLING_CHECKOUT_DRAFT_COLUMNS)
        .single()

  const { data, error } = await mutation

  if (error || !data) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao salvar checkout draft' }, 500)
  }

  return ok(request, {
    draft: data as BillingCheckoutDraft,
    writeEnabled: true,
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingCheckoutDraftPayload)
})
