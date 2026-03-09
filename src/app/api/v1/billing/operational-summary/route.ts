import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withBillingAuth } from '@/lib/billing/api'
import type {
  BillingOperationalSummary,
  BillingOperationalSummaryPayload,
  BillingProviderCode,
  BillingProviderSetting,
  BillingSubscriptionEvent,
  BillingSubscriptionReadiness,
  BillingSubscriptionState,
} from '@/shared/types/billing'

const BILLING_PROVIDER_COLUMNS =
  'provider_code, operational_status, account_reference, publishable_key_hint, webhook_endpoint_hint'
const BILLING_PLAN_COLUMNS = 'slug, status, featured'
const BILLING_SUBSCRIPTION_READINESS_COLUMNS =
  'selected_plan_slug, preferred_provider, launch_mode, kyc_status, terms_accepted'
const BILLING_SUBSCRIPTION_STATE_COLUMNS = 'status, provider_code, cancel_at_period_end, last_synced_at, launched_at'
const BILLING_SUBSCRIPTION_EVENT_COLUMNS = 'event_type, effective_at'

type BillingProviderSummaryRow = Pick<
  BillingProviderSetting,
  'provider_code' | 'operational_status' | 'account_reference' | 'publishable_key_hint' | 'webhook_endpoint_hint'
>

type BillingPlanSummaryRow = {
  slug: string
  status: 'draft' | 'active' | 'archived'
  featured: boolean
}

type BillingSubscriptionReadinessSummaryRow = Pick<
  BillingSubscriptionReadiness,
  'selected_plan_slug' | 'preferred_provider' | 'launch_mode' | 'kyc_status' | 'terms_accepted'
>

type BillingSubscriptionStateSummaryRow = Pick<
  BillingSubscriptionState,
  'status' | 'provider_code' | 'cancel_at_period_end' | 'last_synced_at' | 'launched_at'
>

type BillingSubscriptionEventSummaryRow = Pick<BillingSubscriptionEvent, 'event_type' | 'effective_at'>

const PROVIDER_CODES: BillingProviderCode[] = ['stripe', 'mercadopago']

function buildDefaultReadiness(): BillingSubscriptionReadinessSummaryRow {
  return {
    selected_plan_slug: null,
    preferred_provider: 'stripe',
    launch_mode: 'internal_preview',
    kyc_status: 'not_started',
    terms_accepted: false,
  }
}

function buildDefaultState(): BillingSubscriptionStateSummaryRow {
  return {
    status: 'inactive',
    provider_code: 'stripe',
    cancel_at_period_end: false,
    last_synced_at: null,
    launched_at: null,
  }
}

function buildProviderRows(rows: BillingProviderSummaryRow[]): BillingProviderSummaryRow[] {
  const rowByCode = new Map(rows.map((row) => [row.provider_code, row]))
  return PROVIDER_CODES.map((providerCode) => {
    return (
      rowByCode.get(providerCode) || {
        provider_code: providerCode,
        operational_status: 'planned',
        account_reference: null,
        publishable_key_hint: null,
        webhook_endpoint_hint: null,
      }
    )
  })
}

function isProviderConfigured(row: BillingProviderSummaryRow) {
  return Boolean(
    row.account_reference?.trim() ||
      row.publishable_key_hint?.trim() ||
      row.webhook_endpoint_hint?.trim() ||
      row.operational_status !== 'planned'
  )
}

function isProviderReady(row: BillingProviderSummaryRow) {
  return row.operational_status === 'sandbox_ready' || row.operational_status === 'beta_ready'
}

export const GET = withBillingAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const [
    providersResult,
    plansResult,
    readinessResult,
    stateResult,
    eventsResult,
  ] = await Promise.all([
    supabase.from('billing_provider_settings').select(BILLING_PROVIDER_COLUMNS).eq('org_id', orgId),
    supabase.from('billing_plan_catalog').select(BILLING_PLAN_COLUMNS).eq('org_id', orgId).limit(50),
    supabase
      .from('billing_subscription_readiness')
      .select(BILLING_SUBSCRIPTION_READINESS_COLUMNS)
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('billing_subscription_states')
      .select(BILLING_SUBSCRIPTION_STATE_COLUMNS)
      .eq('org_id', orgId)
      .maybeSingle(),
    supabase
      .from('billing_subscription_events')
      .select(BILLING_SUBSCRIPTION_EVENT_COLUMNS)
      .eq('org_id', orgId)
      .order('effective_at', { ascending: false })
      .limit(30),
  ])

  const firstError =
    providersResult.error ||
    plansResult.error ||
    readinessResult.error ||
    stateResult.error ||
    eventsResult.error

  if (firstError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: firstError.message }, 500)
  }

  const providers = buildProviderRows(((providersResult.data || []) as unknown) as BillingProviderSummaryRow[])
  const plans = ((plansResult.data || []) as unknown) as BillingPlanSummaryRow[]
  const readiness =
    ((readinessResult.data as BillingSubscriptionReadinessSummaryRow | null) || buildDefaultReadiness())
  const state = ((stateResult.data as BillingSubscriptionStateSummaryRow | null) || buildDefaultState())
  const events = ((eventsResult.data || []) as unknown) as BillingSubscriptionEventSummaryRow[]

  const providerConfiguredCount = providers.filter(isProviderConfigured).length
  const providerReadyCount = providers.filter(isProviderReady).length
  const activePlans = plans.filter((plan) => plan.status === 'active')
  const activePlanCount = activePlans.length
  const featuredPlanSlug = plans.find((plan) => plan.featured)?.slug || null
  const activePlanSlugs = new Set(activePlans.map((plan) => plan.slug))
  const latestEventAt = events[0]?.effective_at || null
  const paymentFailedRecently = events.some((event) => {
    if (event.event_type !== 'payment_failed') return false
    const eventTime = Date.parse(event.effective_at)
    if (Number.isNaN(eventTime)) return false
    return Date.now() - eventTime <= 1000 * 60 * 60 * 24 * 30
  })

  const blockers: string[] = []
  if (providerReadyCount === 0) {
    blockers.push('Nenhum provider de billing está pronto para sandbox ou beta.')
  }
  if (!readiness.selected_plan_slug) {
    blockers.push('Nenhum plano foi selecionado para a assinatura da organização.')
  }
  if (activePlanCount === 0) {
    blockers.push('O catálogo ainda não possui plano ativo para lançamento controlado.')
  }
  if (readiness.selected_plan_slug && !activePlanSlugs.has(readiness.selected_plan_slug)) {
    blockers.push('O plano selecionado ainda não está ativo no catálogo interno.')
  }
  if (readiness.kyc_status !== 'ready') {
    blockers.push('O readiness fiscal/KYC da organização ainda não está marcado como pronto.')
  }
  if (!readiness.terms_accepted) {
    blockers.push('Os termos internos de cobrança ainda não foram aceitos para esta organização.')
  }

  const warnings: string[] = []
  if (state.status === 'past_due') {
    warnings.push('A assinatura está marcada como past_due e exige reconciliação antes de ampliar rollout.')
  }
  if (state.status === 'paused') {
    warnings.push('A assinatura está pausada e precisa de decisão operacional antes do general release.')
  }
  if (state.cancel_at_period_end) {
    warnings.push('A assinatura está configurada para cancelar no fim do período atual.')
  }
  if (!state.last_synced_at && (state.status !== 'inactive' || Boolean(state.launched_at))) {
    warnings.push('Não há timestamp recente de sincronização operacional da assinatura.')
  }
  if (paymentFailedRecently) {
    warnings.push('Existe ao menos um evento recente de payment_failed na timeline operacional.')
  }

  const summary: BillingOperationalSummary = {
    status: blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'attention' : 'healthy',
    blockers,
    warnings,
    snapshot: {
      providerConfiguredCount,
      providerReadyCount,
      activePlanCount,
      featuredPlanSlug,
      preferredProvider: readiness.preferred_provider,
      launchMode: readiness.launch_mode,
      kycStatus: readiness.kyc_status,
      termsAccepted: readiness.terms_accepted,
      subscriptionStatus: state.status,
      lastEventAt: latestEventAt,
      lastSyncAt: state.last_synced_at,
    },
  }

  return ok(request, { summary } satisfies BillingOperationalSummaryPayload)
})
