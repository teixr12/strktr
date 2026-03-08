import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withBillingAuth } from '@/lib/billing/api'
import { getBillingRuntimeStage, isBillingWriteEnabled } from '@/lib/billing/feature'
import { billingSubscriptionStatePatchSchema } from '@/shared/schemas/billing'
import type { BillingSubscriptionState, BillingSubscriptionStatePayload } from '@/shared/types/billing'

const BILLING_SUBSCRIPTION_STATE_COLUMNS =
  'id, org_id, status, provider_code, plan_slug, external_customer_ref, external_subscription_ref, current_period_start_at, current_period_end_at, trial_ends_at, cancel_at_period_end, auto_renew, launched_at, last_synced_at, notes, created_at, updated_at'

function buildDefaultSubscriptionState(orgId: string): BillingSubscriptionState {
  return {
    id: null,
    org_id: orgId,
    status: 'inactive',
    provider_code: 'stripe',
    plan_slug: null,
    external_customer_ref: null,
    external_subscription_ref: null,
    current_period_start_at: null,
    current_period_end_at: null,
    trial_ends_at: null,
    cancel_at_period_end: false,
    auto_renew: false,
    launched_at: null,
    last_synced_at: null,
    notes: null,
    created_at: null,
    updated_at: null,
  }
}

export const GET = withBillingAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { data, error } = await supabase
    .from('billing_subscription_states')
    .select(BILLING_SUBSCRIPTION_STATE_COLUMNS)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, {
    subscription: (data as BillingSubscriptionState | null) || buildDefaultSubscriptionState(orgId),
    writeEnabled: isBillingWriteEnabled(),
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingSubscriptionStatePayload)
})

export const PATCH = withBillingAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  if (!isBillingWriteEnabled()) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'Estado operacional de assinatura está bloqueado em produção. Use preview/staging.',
      },
      403
    )
  }

  const parsed = billingSubscriptionStatePatchSchema.safeParse(await request.json().catch(() => null))
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

  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.provider_code !== undefined) updates.provider_code = parsed.data.provider_code
  if (parsed.data.plan_slug !== undefined) updates.plan_slug = parsed.data.plan_slug
  if (parsed.data.external_customer_ref !== undefined) updates.external_customer_ref = parsed.data.external_customer_ref
  if (parsed.data.external_subscription_ref !== undefined) {
    updates.external_subscription_ref = parsed.data.external_subscription_ref
  }
  if (parsed.data.current_period_start_at !== undefined) updates.current_period_start_at = parsed.data.current_period_start_at
  if (parsed.data.current_period_end_at !== undefined) updates.current_period_end_at = parsed.data.current_period_end_at
  if (parsed.data.trial_ends_at !== undefined) updates.trial_ends_at = parsed.data.trial_ends_at
  if (parsed.data.cancel_at_period_end !== undefined) updates.cancel_at_period_end = parsed.data.cancel_at_period_end
  if (parsed.data.auto_renew !== undefined) updates.auto_renew = parsed.data.auto_renew
  if (parsed.data.launched_at !== undefined) updates.launched_at = parsed.data.launched_at
  if (parsed.data.last_synced_at !== undefined) updates.last_synced_at = parsed.data.last_synced_at
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

  const { data: existing, error: existingError } = await supabase
    .from('billing_subscription_states')
    .select('id')
    .eq('org_id', orgId)
    .maybeSingle()

  if (existingError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingError.message }, 500)
  }

  const mutation = existing?.id
    ? supabase
        .from('billing_subscription_states')
        .update(updates)
        .eq('id', existing.id)
        .eq('org_id', orgId)
        .select(BILLING_SUBSCRIPTION_STATE_COLUMNS)
        .single()
    : supabase
        .from('billing_subscription_states')
        .insert({
          org_id: orgId,
          created_by: user.id,
          ...updates,
        })
        .select(BILLING_SUBSCRIPTION_STATE_COLUMNS)
        .single()

  const { data, error } = await mutation

  if (error || !data) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao salvar estado operacional da assinatura' },
      500
    )
  }

  return ok(request, {
    subscription: data as BillingSubscriptionState,
    writeEnabled: true,
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingSubscriptionStatePayload)
})
