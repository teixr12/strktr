import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withBillingAuth } from '@/lib/billing/api'
import { getBillingRuntimeStage, isBillingWriteEnabled } from '@/lib/billing/feature'
import { billingPlanCatalogPatchSchema } from '@/shared/schemas/billing'
import type { BillingPlanCatalogItem, BillingPlanCatalogPayload } from '@/shared/types/billing'

const BILLING_PLAN_COLUMNS =
  'id, org_id, slug, name, description, status, currency, monthly_price_cents, annual_price_cents, trial_days, accepted_providers, feature_bullets, featured, notes, created_at, updated_at'

function resolvePlanId(request: Request): string | null {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  const plansIndex = segments.findIndex((segment) => segment === 'plans')
  const id = plansIndex >= 0 ? segments[plansIndex + 1] : null
  return id?.trim() || null
}

export const PATCH = withBillingAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
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

  const planId = resolvePlanId(request)
  if (!planId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'id inválido' }, 400)
  }

  const parsed = billingPlanCatalogPatchSchema.safeParse(await request.json().catch(() => null))
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

  const updates: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.description !== undefined) updates.description = parsed.data.description || null
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency.toUpperCase()
  if (parsed.data.monthly_price_cents !== undefined) updates.monthly_price_cents = parsed.data.monthly_price_cents
  if (parsed.data.annual_price_cents !== undefined) updates.annual_price_cents = parsed.data.annual_price_cents
  if (parsed.data.trial_days !== undefined) updates.trial_days = parsed.data.trial_days
  if (parsed.data.accepted_providers !== undefined) updates.accepted_providers = parsed.data.accepted_providers
  if (parsed.data.feature_bullets !== undefined) updates.feature_bullets = parsed.data.feature_bullets
  if (parsed.data.featured !== undefined) updates.featured = parsed.data.featured
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes || null

  const { data, error } = await supabase
    .from('billing_plan_catalog')
    .update(updates)
    .eq('id', planId)
    .eq('org_id', orgId)
    .select(BILLING_PLAN_COLUMNS)
    .maybeSingle()

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }
  if (!data) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Plano não encontrado' }, 404)
  }

  return ok(request, {
    items: [data as BillingPlanCatalogItem],
    writeEnabled: true,
    runtimeStage: getBillingRuntimeStage(),
  } satisfies BillingPlanCatalogPayload)
})
