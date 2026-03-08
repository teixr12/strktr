import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withBillingAuth } from '@/lib/billing/api'
import { getBillingRuntimeStage, isBillingWriteEnabled } from '@/lib/billing/feature'
import { billingSubscriptionEventCreateSchema } from '@/shared/schemas/billing'
import type { BillingSubscriptionEvent, BillingSubscriptionEventsPayload } from '@/shared/types/billing'

const BILLING_SUBSCRIPTION_EVENT_COLUMNS =
  'id, org_id, event_type, actor_label, summary, details, status_before, status_after, provider_code, effective_at, created_at'

export const GET = withBillingAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { data, error } = await supabase
    .from('billing_subscription_events')
    .select(BILLING_SUBSCRIPTION_EVENT_COLUMNS)
    .eq('org_id', orgId)
    .order('effective_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, {
    events: ((data || []) as unknown) as BillingSubscriptionEvent[],
    writeEnabled: isBillingWriteEnabled(),
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingSubscriptionEventsPayload)
})

export const POST = withBillingAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  if (!isBillingWriteEnabled()) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'Timeline operacional de assinatura está bloqueada em produção. Use preview/staging.',
      },
      403
    )
  }

  const parsed = billingSubscriptionEventCreateSchema.safeParse(await request.json().catch(() => null))
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

  const { data, error } = await supabase
    .from('billing_subscription_events')
    .insert({
      org_id: orgId,
      created_by: user.id,
      event_type: parsed.data.event_type,
      actor_label: parsed.data.actor_label ?? null,
      summary: parsed.data.summary,
      details: parsed.data.details ?? null,
      status_before: parsed.data.status_before ?? null,
      status_after: parsed.data.status_after ?? null,
      provider_code: parsed.data.provider_code ?? null,
      effective_at: parsed.data.effective_at,
    })
    .select(BILLING_SUBSCRIPTION_EVENT_COLUMNS)
    .single()

  if (error || !data) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao criar evento operacional da assinatura' },
      500
    )
  }

  return ok(request, {
    events: [data as BillingSubscriptionEvent],
    writeEnabled: true,
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingSubscriptionEventsPayload)
})
