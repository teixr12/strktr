import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withBillingAuth } from '@/lib/billing/api'
import { getBillingRuntimeStage, isBillingWriteEnabled } from '@/lib/billing/feature'
import { billingPlanCatalogCreateSchema } from '@/shared/schemas/billing'
import type { BillingPlanCatalogItem, BillingPlanCatalogPayload } from '@/shared/types/billing'

const BILLING_PLAN_COLUMNS =
  'id, org_id, slug, name, description, status, currency, monthly_price_cents, annual_price_cents, trial_days, accepted_providers, feature_bullets, featured, notes, created_at, updated_at'

export const GET = withBillingAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { data, error } = await supabase
    .from('billing_plan_catalog')
    .select(BILLING_PLAN_COLUMNS)
    .eq('org_id', orgId)
    .order('featured', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, {
    items: (data || []) as BillingPlanCatalogItem[],
    writeEnabled: isBillingWriteEnabled(),
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingPlanCatalogPayload)
})

export const POST = withBillingAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  if (!isBillingWriteEnabled()) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'Catálogo de planos de billing está bloqueado em produção. Use preview/staging.',
      },
      403
    )
  }

  const parsed = billingPlanCatalogCreateSchema.safeParse(await request.json().catch(() => null))
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
    .from('billing_plan_catalog')
    .insert({
      org_id: orgId,
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description || null,
      status: parsed.data.status,
      currency: parsed.data.currency.toUpperCase(),
      monthly_price_cents: parsed.data.monthly_price_cents ?? null,
      annual_price_cents: parsed.data.annual_price_cents ?? null,
      trial_days: parsed.data.trial_days,
      accepted_providers: parsed.data.accepted_providers,
      feature_bullets: parsed.data.feature_bullets,
      featured: parsed.data.featured,
      notes: parsed.data.notes || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(BILLING_PLAN_COLUMNS)
    .single()

  if (error || !data) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao criar plano' }, 500)
  }

  return ok(request, {
    items: [data as BillingPlanCatalogItem],
    writeEnabled: true,
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingPlanCatalogPayload)
})
