import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withBillingAuth } from '@/lib/billing/api'
import { getBillingRuntimeStage, isBillingWriteEnabled } from '@/lib/billing/feature'
import { billingSubscriptionReadinessPatchSchema } from '@/shared/schemas/billing'
import type { BillingSubscriptionReadiness, BillingSubscriptionReadinessPayload } from '@/shared/types/billing'

const BILLING_SUBSCRIPTION_READINESS_COLUMNS =
  'id, org_id, selected_plan_slug, preferred_provider, billing_contact_name, billing_contact_email, finance_owner_name, finance_owner_email, company_legal_name, company_address, launch_mode, kyc_status, terms_accepted, notes, created_at, updated_at'

function buildDefaultSubscriptionReadiness(orgId: string): BillingSubscriptionReadiness {
  return {
    id: null,
    org_id: orgId,
    selected_plan_slug: null,
    preferred_provider: 'stripe',
    billing_contact_name: null,
    billing_contact_email: null,
    finance_owner_name: null,
    finance_owner_email: null,
    company_legal_name: null,
    company_address: null,
    launch_mode: 'internal_preview',
    kyc_status: 'not_started',
    terms_accepted: false,
    notes: null,
    created_at: null,
    updated_at: null,
  }
}

export const GET = withBillingAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { data, error } = await supabase
    .from('billing_subscription_readiness')
    .select(BILLING_SUBSCRIPTION_READINESS_COLUMNS)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, {
    readiness: (data as BillingSubscriptionReadiness | null) || buildDefaultSubscriptionReadiness(orgId),
    writeEnabled: isBillingWriteEnabled(),
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingSubscriptionReadinessPayload)
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

  const parsed = billingSubscriptionReadinessPatchSchema.safeParse(await request.json().catch(() => null))
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

  if (parsed.data.selected_plan_slug !== undefined) updates.selected_plan_slug = parsed.data.selected_plan_slug
  if (parsed.data.preferred_provider !== undefined) updates.preferred_provider = parsed.data.preferred_provider
  if (parsed.data.billing_contact_name !== undefined) updates.billing_contact_name = parsed.data.billing_contact_name
  if (parsed.data.billing_contact_email !== undefined) updates.billing_contact_email = parsed.data.billing_contact_email
  if (parsed.data.finance_owner_name !== undefined) updates.finance_owner_name = parsed.data.finance_owner_name
  if (parsed.data.finance_owner_email !== undefined) updates.finance_owner_email = parsed.data.finance_owner_email
  if (parsed.data.company_legal_name !== undefined) updates.company_legal_name = parsed.data.company_legal_name
  if (parsed.data.company_address !== undefined) updates.company_address = parsed.data.company_address
  if (parsed.data.launch_mode !== undefined) updates.launch_mode = parsed.data.launch_mode
  if (parsed.data.kyc_status !== undefined) updates.kyc_status = parsed.data.kyc_status
  if (parsed.data.terms_accepted !== undefined) updates.terms_accepted = parsed.data.terms_accepted
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

  const { data: existing, error: existingError } = await supabase
    .from('billing_subscription_readiness')
    .select('id')
    .eq('org_id', orgId)
    .maybeSingle()

  if (existingError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingError.message }, 500)
  }

  const mutation = existing?.id
    ? supabase
        .from('billing_subscription_readiness')
        .update(updates)
        .eq('id', existing.id)
        .eq('org_id', orgId)
        .select(BILLING_SUBSCRIPTION_READINESS_COLUMNS)
        .single()
    : supabase
        .from('billing_subscription_readiness')
        .insert({
          org_id: orgId,
          created_by: user.id,
          ...updates,
        })
        .select(BILLING_SUBSCRIPTION_READINESS_COLUMNS)
        .single()

  const { data, error } = await mutation

  if (error || !data) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao salvar subscription readiness' },
      500
    )
  }

  return ok(request, {
    readiness: data as BillingSubscriptionReadiness,
    writeEnabled: true,
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingSubscriptionReadinessPayload)
})
