'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clock3, CreditCard, Loader2, RefreshCcw, ReceiptText, Save, ShieldCheck } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import type {
  BillingAdminSettings,
  BillingAdminSettingsPayload,
  BillingChecklistItem,
  BillingCheckoutDraft,
  BillingCheckoutDraftPayload,
  BillingOperationalSummary,
  BillingOperationalSummaryPayload,
  BillingOrgProfile,
  BillingPlanCatalogItem,
  BillingPlanCatalogPayload,
  BillingPlanStatus,
  BillingProviderSetting,
  BillingProviderSettingsPayload,
  BillingProviderStatus,
  BillingReadinessSummary,
  BillingRuntimeStage,
  BillingSubscriptionEvent,
  BillingSubscriptionEventsPayload,
  BillingSubscriptionReadiness,
  BillingSubscriptionReadinessPayload,
  BillingSubscriptionState,
  BillingSubscriptionStatePayload,
  BillingSurface,
} from '@/shared/types/billing'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'

type Meta = {
  summary?: BillingReadinessSummary
  checklist?: BillingChecklistItem[]
  orgProfile?: BillingOrgProfile
  surfaces?: BillingSurface[]
}

const EMPTY_SUMMARY: BillingReadinessSummary = {
  totalProviders: 0,
  readyProviders: 0,
  setupRequiredProviders: 0,
  betaReadySurfaces: 0,
  plannedSurfaces: 0,
  complianceGatedSurfaces: 0,
  checklistReady: 0,
  checklistBlocked: 0,
}

const EMPTY_ORG_PROFILE: BillingOrgProfile = {
  orgName: null,
  plan: null,
  cnpj: null,
  profileReady: false,
}

const EMPTY_SETTINGS: BillingAdminSettings = {
  id: null,
  org_id: '',
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

const EMPTY_CHECKOUT_DRAFT: BillingCheckoutDraft = {
  id: null,
  org_id: '',
  plan_slug: 'strktr-pro',
  headline: 'Plano PRO para operação, CRM e financeiro da construtora',
  subheadline: 'Checkout sandbox interno para validar copy, pricing e conversão sem cobrança real.',
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

type BillingPlanDraft = {
  slug: string
  name: string
  description: string
  status: BillingPlanStatus
  currency: string
  monthly_price_cents: number | null
  annual_price_cents: number | null
  trial_days: number
  accepted_providers: Array<'stripe' | 'mercadopago'>
  feature_bullets: string[]
  featured: boolean
  notes: string
}

const EMPTY_PLAN_DRAFT: BillingPlanDraft = {
  slug: 'strktr-pro',
  name: 'STRKTR PRO',
  description: 'Plano interno para validar pricing, copy e governança antes de abrir checkout real.',
  status: 'draft',
  currency: 'BRL',
  monthly_price_cents: null,
  annual_price_cents: null,
  trial_days: 14,
  accepted_providers: ['stripe'],
  feature_bullets: [
    'CRM, obras e financeiro na mesma operação',
    'Portal e documentos com governança única',
  ],
  featured: true,
  notes: '',
}

const EMPTY_PROVIDER_SETTINGS: BillingProviderSetting[] = [
  {
    id: null,
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
    created_at: null,
    updated_at: null,
  },
  {
    id: null,
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
    created_at: null,
    updated_at: null,
  },
]

const EMPTY_SUBSCRIPTION_READINESS: BillingSubscriptionReadiness = {
  id: null,
  org_id: '',
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

const EMPTY_SUBSCRIPTION_STATE: BillingSubscriptionState = {
  id: null,
  org_id: '',
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

const EMPTY_SUBSCRIPTION_EVENTS: BillingSubscriptionEvent[] = []
const EMPTY_OPERATIONAL_SUMMARY: BillingOperationalSummary = {
  status: 'blocked',
  blockers: [],
  warnings: [],
  snapshot: {
    providerConfiguredCount: 0,
    providerReadyCount: 0,
    activePlanCount: 0,
    featuredPlanSlug: null,
    preferredProvider: 'stripe',
    launchMode: 'internal_preview',
    kycStatus: 'not_started',
    termsAccepted: false,
    subscriptionStatus: 'inactive',
    lastEventAt: null,
    lastSyncAt: null,
  },
}

type BillingSubscriptionEventDraft = {
  event_type: BillingSubscriptionEvent['event_type']
  actor_label: string
  summary: string
  details: string
  status_before: BillingSubscriptionEvent['status_before']
  status_after: BillingSubscriptionEvent['status_after']
  provider_code: BillingSubscriptionEvent['provider_code']
  effective_at: string
}

const EMPTY_SUBSCRIPTION_EVENT_DRAFT: BillingSubscriptionEventDraft = {
  event_type: 'note',
  actor_label: 'Operação STRKTR',
  summary: '',
  details: '',
  status_before: null,
  status_after: null,
  provider_code: 'stripe',
  effective_at: toDatetimeLocal(new Date().toISOString()),
}

function tone(value: string) {
  if (value === 'ready' || value === 'beta_ready') return 'bg-emerald-100 text-emerald-700'
  if (value === 'blocked') return 'bg-red-100 text-red-700'
  if (value === 'setup_required') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-700'
}

function moneyFromCents(value: number | null): string {
  if (value === null || Number.isNaN(value)) return ''
  return (value / 100).toFixed(2)
}

function centsFromMoney(value: string): number | null {
  const normalized = value.replace(',', '.').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function planTone(value: BillingPlanStatus) {
  if (value === 'active') return 'bg-emerald-100 text-emerald-700'
  if (value === 'archived') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

function readinessCount(readiness: BillingSubscriptionReadiness) {
  const checks = [
    Boolean(readiness.selected_plan_slug?.trim()),
    Boolean(readiness.billing_contact_name?.trim() && readiness.billing_contact_email?.trim()),
    Boolean(readiness.finance_owner_name?.trim() && readiness.finance_owner_email?.trim()),
    Boolean(readiness.company_legal_name?.trim() && readiness.company_address?.trim()),
    readiness.kyc_status === 'ready',
    readiness.terms_accepted,
  ]

  return {
    ready: checks.filter(Boolean).length,
    total: checks.length,
  }
}

function subscriptionStateTone(value: BillingSubscriptionState['status']) {
  if (value === 'active' || value === 'trialing' || value === 'sandbox') return 'bg-emerald-100 text-emerald-700'
  if (value === 'past_due' || value === 'paused') return 'bg-amber-100 text-amber-700'
  if (value === 'canceled') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

function subscriptionEventTone(value: BillingSubscriptionEvent['event_type']) {
  if (value === 'renewed' || value === 'resumed') return 'bg-emerald-100 text-emerald-700'
  if (value === 'payment_failed' || value === 'canceled') return 'bg-red-100 text-red-700'
  if (value === 'trial_started' || value === 'renewal_scheduled' || value === 'paused') {
    return 'bg-amber-100 text-amber-700'
  }
  return 'bg-gray-100 text-gray-700'
}

function operationalSummaryTone(value: BillingOperationalSummary['status']) {
  if (value === 'healthy') return 'bg-emerald-100 text-emerald-700'
  if (value === 'attention') return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function operationalSummaryLabel(value: BillingOperationalSummary['status']) {
  if (value === 'healthy') return 'healthy'
  if (value === 'attention') return 'attention'
  return 'blocked'
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDatetimeLocal(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function BillingOverviewContent() {
  const [providers, setProviders] = useState<BillingProviderStatus[]>([])
  const [summary, setSummary] = useState<BillingReadinessSummary>(EMPTY_SUMMARY)
  const [checklist, setChecklist] = useState<BillingChecklistItem[]>([])
  const [surfaces, setSurfaces] = useState<BillingSurface[]>([])
  const [orgProfile, setOrgProfile] = useState<BillingOrgProfile>(EMPTY_ORG_PROFILE)
  const [settings, setSettings] = useState<BillingAdminSettings>(EMPTY_SETTINGS)
  const [subscriptionReadiness, setSubscriptionReadiness] = useState<BillingSubscriptionReadiness>(
    EMPTY_SUBSCRIPTION_READINESS
  )
  const [subscriptionState, setSubscriptionState] = useState<BillingSubscriptionState>(EMPTY_SUBSCRIPTION_STATE)
  const [subscriptionEvents, setSubscriptionEvents] = useState<BillingSubscriptionEvent[]>(EMPTY_SUBSCRIPTION_EVENTS)
  const [operationalSummary, setOperationalSummary] = useState<BillingOperationalSummary>(EMPTY_OPERATIONAL_SUMMARY)
  const [subscriptionEventDraft, setSubscriptionEventDraft] = useState<BillingSubscriptionEventDraft>(
    EMPTY_SUBSCRIPTION_EVENT_DRAFT
  )
  const [checkoutDraft, setCheckoutDraft] = useState<BillingCheckoutDraft>(EMPTY_CHECKOUT_DRAFT)
  const [plans, setPlans] = useState<BillingPlanCatalogItem[]>([])
  const [providerSettings, setProviderSettings] = useState<BillingProviderSetting[]>(EMPTY_PROVIDER_SETTINGS)
  const [planDraft, setPlanDraft] = useState<BillingPlanDraft>(EMPTY_PLAN_DRAFT)
  const [writeEnabled, setWriteEnabled] = useState(false)
  const [runtimeStage, setRuntimeStage] = useState<BillingRuntimeStage>('unknown')
  const [saving, setSaving] = useState(false)
  const [savingSubscriptionReadiness, setSavingSubscriptionReadiness] = useState(false)
  const [savingSubscriptionState, setSavingSubscriptionState] = useState(false)
  const [savingSubscriptionEvent, setSavingSubscriptionEvent] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null)
  const [busyProviderCode, setBusyProviderCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [
        payload,
        settingsPayload,
        subscriptionReadinessPayload,
        subscriptionStatePayload,
        subscriptionEventsPayload,
        draftPayload,
        plansPayload,
        providerSettingsPayload,
        operationalSummaryPayload,
      ] = await Promise.all([
        apiRequestWithMeta<BillingProviderStatus[], Meta>('/api/v1/billing/readiness'),
        apiRequest<BillingAdminSettingsPayload>('/api/v1/billing/settings'),
        apiRequest<BillingSubscriptionReadinessPayload>('/api/v1/billing/subscription-readiness'),
        apiRequest<BillingSubscriptionStatePayload>('/api/v1/billing/subscription-state'),
        apiRequest<BillingSubscriptionEventsPayload>('/api/v1/billing/subscription-events'),
        apiRequest<BillingCheckoutDraftPayload>('/api/v1/billing/checkout-draft'),
        apiRequest<BillingPlanCatalogPayload>('/api/v1/billing/plans'),
        apiRequest<BillingProviderSettingsPayload>('/api/v1/billing/providers'),
        apiRequest<BillingOperationalSummaryPayload>('/api/v1/billing/operational-summary'),
      ])
      setProviders(payload.data)
      setSummary(payload.meta?.summary || EMPTY_SUMMARY)
      setChecklist(payload.meta?.checklist || [])
      setOrgProfile(payload.meta?.orgProfile || EMPTY_ORG_PROFILE)
      setSurfaces(payload.meta?.surfaces || [])
      setSettings(settingsPayload.settings)
      setSubscriptionReadiness(subscriptionReadinessPayload.readiness)
      setSubscriptionState(subscriptionStatePayload.subscription)
      setSubscriptionEvents(subscriptionEventsPayload.events)
      setCheckoutDraft(draftPayload.draft)
      setPlans(plansPayload.items)
      setProviderSettings(providerSettingsPayload.items)
      setOperationalSummary(operationalSummaryPayload.summary)
      setWriteEnabled(
          settingsPayload.writeEnabled &&
          subscriptionReadinessPayload.writeEnabled &&
          subscriptionStatePayload.writeEnabled &&
          subscriptionEventsPayload.writeEnabled &&
          draftPayload.writeEnabled &&
          plansPayload.writeEnabled &&
          providerSettingsPayload.writeEnabled
      )
      setRuntimeStage(settingsPayload.runtimeStage)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar readiness de billing'
      setError(message)
      toast(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    setSubscriptionEventDraft((current) => ({
      ...current,
      provider_code: current.provider_code ?? subscriptionState.provider_code,
      status_before: current.status_before ?? subscriptionState.status,
      status_after: current.status_after ?? subscriptionState.status,
    }))
  }, [subscriptionState.provider_code, subscriptionState.status])

  async function saveSettings() {
    setSaving(true)
    try {
      const payload = await apiRequest<BillingAdminSettingsPayload>('/api/v1/billing/settings', {
        method: 'PATCH',
        body: settings,
      })
      setSettings(payload.settings)
      setWriteEnabled(payload.writeEnabled)
      setRuntimeStage(payload.runtimeStage)
      toast('Configuração interna de billing atualizada', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar billing'
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveSubscriptionReadiness() {
    setSavingSubscriptionReadiness(true)
    try {
      const payload = await apiRequest<BillingSubscriptionReadinessPayload>('/api/v1/billing/subscription-readiness', {
        method: 'PATCH',
        body: {
          selected_plan_slug: subscriptionReadiness.selected_plan_slug || null,
          preferred_provider: subscriptionReadiness.preferred_provider,
          billing_contact_name: subscriptionReadiness.billing_contact_name || null,
          billing_contact_email: subscriptionReadiness.billing_contact_email || null,
          finance_owner_name: subscriptionReadiness.finance_owner_name || null,
          finance_owner_email: subscriptionReadiness.finance_owner_email || null,
          company_legal_name: subscriptionReadiness.company_legal_name || null,
          company_address: subscriptionReadiness.company_address || null,
          launch_mode: subscriptionReadiness.launch_mode,
          kyc_status: subscriptionReadiness.kyc_status,
          terms_accepted: subscriptionReadiness.terms_accepted,
          notes: subscriptionReadiness.notes || null,
        },
      })
      setSubscriptionReadiness(payload.readiness)
      setWriteEnabled(payload.writeEnabled)
      setRuntimeStage(payload.runtimeStage)
      toast('Subscription readiness atualizada', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar subscription readiness'
      toast(message, 'error')
    } finally {
      setSavingSubscriptionReadiness(false)
    }
  }

  async function saveSubscriptionState() {
    setSavingSubscriptionState(true)
    try {
      const payload = await apiRequest<BillingSubscriptionStatePayload>('/api/v1/billing/subscription-state', {
        method: 'PATCH',
        body: {
          status: subscriptionState.status,
          provider_code: subscriptionState.provider_code,
          plan_slug: subscriptionState.plan_slug || null,
          external_customer_ref: subscriptionState.external_customer_ref || null,
          external_subscription_ref: subscriptionState.external_subscription_ref || null,
          current_period_start_at: subscriptionState.current_period_start_at || null,
          current_period_end_at: subscriptionState.current_period_end_at || null,
          trial_ends_at: subscriptionState.trial_ends_at || null,
          cancel_at_period_end: subscriptionState.cancel_at_period_end,
          auto_renew: subscriptionState.auto_renew,
          launched_at: subscriptionState.launched_at || null,
          last_synced_at: subscriptionState.last_synced_at || null,
          notes: subscriptionState.notes || null,
        },
      })
      setSubscriptionState(payload.subscription)
      setWriteEnabled(payload.writeEnabled)
      setRuntimeStage(payload.runtimeStage)
      toast('Estado operacional da assinatura atualizado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar estado operacional da assinatura'
      toast(message, 'error')
    } finally {
      setSavingSubscriptionState(false)
    }
  }

  async function createSubscriptionEvent() {
    setSavingSubscriptionEvent(true)
    try {
      const payload = await apiRequest<BillingSubscriptionEventsPayload>('/api/v1/billing/subscription-events', {
        method: 'POST',
        body: {
          event_type: subscriptionEventDraft.event_type,
          actor_label: subscriptionEventDraft.actor_label || null,
          summary: subscriptionEventDraft.summary,
          details: subscriptionEventDraft.details || null,
          status_before: subscriptionEventDraft.status_before,
          status_after: subscriptionEventDraft.status_after,
          provider_code: subscriptionEventDraft.provider_code,
          effective_at: fromDatetimeLocal(subscriptionEventDraft.effective_at) || new Date().toISOString(),
        },
      })
      const created = payload.events[0]
      if (created) {
        setSubscriptionEvents((current) => [created, ...current])
      }
      setSubscriptionEventDraft({
        ...EMPTY_SUBSCRIPTION_EVENT_DRAFT,
        provider_code: subscriptionState.provider_code,
        status_before: subscriptionState.status,
        status_after: subscriptionState.status,
        effective_at: toDatetimeLocal(new Date().toISOString()),
      })
      setWriteEnabled(payload.writeEnabled)
      setRuntimeStage(payload.runtimeStage)
      toast('Evento operacional de assinatura registrado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar evento operacional'
      toast(message, 'error')
    } finally {
      setSavingSubscriptionEvent(false)
    }
  }

  async function saveCheckoutDraft() {
    setSavingDraft(true)
    try {
      const payload = await apiRequest<BillingCheckoutDraftPayload>('/api/v1/billing/checkout-draft', {
        method: 'PATCH',
        body: checkoutDraft,
      })
      setCheckoutDraft(payload.draft)
      setWriteEnabled(payload.writeEnabled)
      setRuntimeStage(payload.runtimeStage)
      toast('Checkout draft sandbox atualizado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar checkout draft'
      toast(message, 'error')
    } finally {
      setSavingDraft(false)
    }
  }

  async function createPlan() {
    setSavingPlan(true)
    try {
      const payload = await apiRequest<BillingPlanCatalogPayload>('/api/v1/billing/plans', {
        method: 'POST',
        body: {
          slug: planDraft.slug,
          name: planDraft.name,
          description: planDraft.description || null,
          status: planDraft.status,
          currency: planDraft.currency,
          monthly_price_cents: planDraft.monthly_price_cents,
          annual_price_cents: planDraft.annual_price_cents,
          trial_days: planDraft.trial_days,
          accepted_providers: planDraft.accepted_providers,
          feature_bullets: planDraft.feature_bullets,
          featured: planDraft.featured,
          notes: planDraft.notes || null,
        },
      })
      const created = payload.items[0]
      if (created) {
        setPlans((current) => [created, ...current])
        setPlanDraft(EMPTY_PLAN_DRAFT)
      }
      setWriteEnabled(payload.writeEnabled)
      setRuntimeStage(payload.runtimeStage)
      toast('Plano interno criado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar plano interno'
      toast(message, 'error')
    } finally {
      setSavingPlan(false)
    }
  }

  async function savePlan(planId: string) {
    const plan = plans.find((item) => item.id === planId)
    if (!plan) return

    setBusyPlanId(planId)
    try {
      const payload = await apiRequest<BillingPlanCatalogPayload>(`/api/v1/billing/plans/${planId}`, {
        method: 'PATCH',
        body: {
          slug: plan.slug,
          name: plan.name,
          description: plan.description || null,
          status: plan.status,
          currency: plan.currency,
          monthly_price_cents: plan.monthly_price_cents,
          annual_price_cents: plan.annual_price_cents,
          trial_days: plan.trial_days,
          accepted_providers: plan.accepted_providers,
          feature_bullets: plan.feature_bullets,
          featured: plan.featured,
          notes: plan.notes || null,
        },
      })
      const updated = payload.items[0]
      if (updated) {
        setPlans((current) => current.map((item) => (item.id === planId ? updated : item)))
      }
      setWriteEnabled(payload.writeEnabled)
      setRuntimeStage(payload.runtimeStage)
      toast('Plano interno atualizado', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar plano interno'
      toast(message, 'error')
    } finally {
      setBusyPlanId(null)
    }
  }

  async function saveProvider(providerCode: BillingProviderSetting['provider_code']) {
    const provider = providerSettings.find((item) => item.provider_code === providerCode)
    if (!provider) return

    setBusyProviderCode(providerCode)
    try {
      const payload = await apiRequest<BillingProviderSettingsPayload>('/api/v1/billing/providers', {
        method: 'PATCH',
        body: {
          provider_code: provider.provider_code,
          operational_status: provider.operational_status,
          rollout_mode: provider.rollout_mode,
          account_reference: provider.account_reference || null,
          publishable_key_hint: provider.publishable_key_hint || null,
          webhook_endpoint_hint: provider.webhook_endpoint_hint || null,
          settlement_country: provider.settlement_country || null,
          accepted_currencies: provider.accepted_currencies,
          supports_pix: provider.supports_pix,
          supports_cards: provider.supports_cards,
          notes: provider.notes || null,
        },
      })
      const updated = payload.items[0]
      if (updated) {
        setProviderSettings((current) =>
          current.map((item) => (item.provider_code === providerCode ? updated : item))
        )
      }
      setWriteEnabled(payload.writeEnabled)
      setRuntimeStage(payload.runtimeStage)
      toast(`Configuração do provedor ${providerCode} atualizada`, 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar configuração do provedor'
      toast(message, 'error')
    } finally {
      setBusyProviderCode(null)
    }
  }

  if (!isLoading && providers.length === 0) {
    return (
      <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
        <PageHeader
          title="Billing"
          subtitle="Readiness interno de cobrança"
          actions={<QuickActionBar actions={[{ label: 'Atualizar', icon: <RefreshCcw className="h-4 w-4" />, onClick: () => void refresh() }]} />}
        />
        <EmptyStateAction
          icon={<CreditCard className="h-5 w-5 text-sand-600" />}
          title="Nenhum provedor de billing mapeado"
          description="Assim que a camada de billing estiver disponível, esta tela exibirá provedores, bloqueios e próximos passos."
          actionLabel="Atualizar"
          onAction={() => void refresh()}
        />
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
      <PageHeader
        title="Billing"
        subtitle="Readiness interno para abrir cobrança sem quebrar assinatura, checkout ou reconciliação"
        actions={<QuickActionBar actions={[{ label: 'Atualizar', icon: <RefreshCcw className="h-4 w-4" />, onClick: () => void refresh() }]} />}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard className="p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><CreditCard className="h-3.5 w-3.5" />Provedores</div><p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.totalProviders}</p></SectionCard>
        <SectionCard className="p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><ShieldCheck className="h-3.5 w-3.5" />Prontos</div><p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.readyProviders}</p></SectionCard>
        <SectionCard className="p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><ReceiptText className="h-3.5 w-3.5" />Compliance gated</div><p className="mt-2 text-2xl font-semibold text-red-600">{summary.complianceGatedSurfaces}</p></SectionCard>
        <SectionCard className="p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500"><RefreshCcw className="h-3.5 w-3.5" />Setup required</div><p className="mt-2 text-2xl font-semibold text-amber-600">{summary.setupRequiredProviders}</p></SectionCard>
      </div>

      {error ? (
        <SectionCard className="border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{error}</p>
            <button type="button" onClick={() => void refresh()} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200">Tentar novamente</button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Resumo operacional de billing</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Consolida blockers, warnings e o último sinal operacional antes de qualquer rollout write-capable.
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${operationalSummaryTone(
              operationalSummary.status
            )}`}
          >
            {operationalSummaryLabel(operationalSummary.status)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Providers</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">
              {operationalSummary.snapshot.providerReadyCount} prontos / {operationalSummary.snapshot.providerConfiguredCount}{' '}
              configurados
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Catálogo</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">
              {operationalSummary.snapshot.activePlanCount} ativos
              {operationalSummary.snapshot.featuredPlanSlug
                ? ` · destaque ${operationalSummary.snapshot.featuredPlanSlug}`
                : ' · sem destaque'}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Assinatura</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">
              {operationalSummary.snapshot.subscriptionStatus} · {operationalSummary.snapshot.preferredProvider}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Último sinal</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">
              {operationalSummary.snapshot.lastEventAt
                ? new Date(operationalSummary.snapshot.lastEventAt).toLocaleString('pt-BR')
                : operationalSummary.snapshot.lastSyncAt
                  ? new Date(operationalSummary.snapshot.lastSyncAt).toLocaleString('pt-BR')
                  : 'Sem evento ou sync'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Blockers
            </div>
            {operationalSummary.blockers.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-red-700">
                {operationalSummary.blockers.map((item) => (
                  <li key={item} className="rounded-xl bg-white/60 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-red-700">Nenhum blocker operacional ativo.</p>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
              <Clock3 className="h-4 w-4" />
              Warnings
            </div>
            {operationalSummary.warnings.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-amber-700">
                {operationalSummary.warnings.map((item) => (
                  <li key={item} className="rounded-xl bg-white/60 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-amber-700">Nenhum warning operacional ativo.</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Launch mode</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{operationalSummary.snapshot.launchMode}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">KYC</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{operationalSummary.snapshot.kycStatus}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Termos internos</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">
              {operationalSummary.snapshot.termsAccepted ? 'Aceitos' : 'Pendentes'}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Último sync</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">
              {operationalSummary.snapshot.lastSyncAt
                ? new Date(operationalSummary.snapshot.lastSyncAt).toLocaleString('pt-BR')
                : 'Sem sync registrado'}
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Perfil de cobrança da organização</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Sem esse mínimo, checkout e assinatura continuam bloqueados.</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(orgProfile.profileReady ? 'ready' : 'blocked')}`}>
              {orgProfile.profileReady ? 'ready' : 'blocked'}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900"><p className="text-[11px] uppercase tracking-wide text-gray-500">Organização</p><p className="mt-1 font-medium text-gray-900 dark:text-white">{orgProfile.orgName || 'Não definido'}</p></div>
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900"><p className="text-[11px] uppercase tracking-wide text-gray-500">Plano atual</p><p className="mt-1 font-medium text-gray-900 dark:text-white">{orgProfile.plan || 'Não definido'}</p></div>
            <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900"><p className="text-[11px] uppercase tracking-wide text-gray-500">CNPJ</p><p className="mt-1 font-medium text-gray-900 dark:text-white">{orgProfile.cnpj || 'Não definido'}</p></div>
          </div>
        </SectionCard>

        <SectionCard className="p-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Checklist mínimo</h2>
          <div className="mt-4 space-y-3">
            {checklist.map((item) => (
              <div key={item.key} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.status)}`}>{item.status}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Subscription readiness por organização"
        subtitle="Governança mínima antes de qualquer assinatura write-capable ou checkout aberto."
        right={
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(readinessCount(subscriptionReadiness).ready === readinessCount(subscriptionReadiness).total ? 'ready' : 'setup_required')}`}>
              {readinessCount(subscriptionReadiness).ready}/{readinessCount(subscriptionReadiness).total} pronto
            </span>
            <button
              type="button"
              onClick={() => void saveSubscriptionReadiness()}
              disabled={!writeEnabled || savingSubscriptionReadiness}
              aria-busy={savingSubscriptionReadiness}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {savingSubscriptionReadiness ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar readiness
            </button>
          </div>
        }
        className="p-4"
      >
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Plano alvo</span>
              <input
                value={subscriptionReadiness.selected_plan_slug || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    selected_plan_slug: event.target.value || null,
                  }))
                }
                placeholder="strktr-pro"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Provider preferido</span>
              <select
                value={subscriptionReadiness.preferred_provider}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    preferred_provider: event.target.value as BillingSubscriptionReadiness['preferred_provider'],
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="stripe">Stripe</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Launch mode</span>
              <select
                value={subscriptionReadiness.launch_mode}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    launch_mode: event.target.value as BillingSubscriptionReadiness['launch_mode'],
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="internal_preview">internal_preview</option>
                <option value="allowlist_beta">allowlist_beta</option>
                <option value="general_blocked">general_blocked</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Billing owner</span>
              <input
                value={subscriptionReadiness.billing_contact_name || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    billing_contact_name: event.target.value || null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Billing email</span>
              <input
                value={subscriptionReadiness.billing_contact_email || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    billing_contact_email: event.target.value || null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Finance owner</span>
              <input
                value={subscriptionReadiness.finance_owner_name || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    finance_owner_name: event.target.value || null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Finance email</span>
              <input
                value={subscriptionReadiness.finance_owner_email || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    finance_owner_email: event.target.value || null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Razão social</span>
              <input
                value={subscriptionReadiness.company_legal_name || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    company_legal_name: event.target.value || null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">KYC</span>
              <select
                value={subscriptionReadiness.kyc_status}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    kyc_status: event.target.value as BillingSubscriptionReadiness['kyc_status'],
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="not_started">not_started</option>
                <option value="in_progress">in_progress</option>
                <option value="ready">ready</option>
              </select>
            </label>
            <label className="space-y-1 text-sm md:col-span-2 xl:col-span-3">
              <span className="text-gray-600 dark:text-gray-300">Endereço da empresa</span>
              <input
                value={subscriptionReadiness.company_address || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    company_address: event.target.value || null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2 xl:col-span-3">
              <span className="text-gray-600 dark:text-gray-300">Notas</span>
              <textarea
                rows={3}
                value={subscriptionReadiness.notes || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    notes: event.target.value || null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Checklist de assinatura</h3>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  {
                    label: 'Plano alvo definido',
                    ready: Boolean(subscriptionReadiness.selected_plan_slug?.trim()),
                  },
                  {
                    label: 'Contato de billing completo',
                    ready: Boolean(
                      subscriptionReadiness.billing_contact_name?.trim() &&
                        subscriptionReadiness.billing_contact_email?.trim()
                    ),
                  },
                  {
                    label: 'Contato financeiro completo',
                    ready: Boolean(
                      subscriptionReadiness.finance_owner_name?.trim() &&
                        subscriptionReadiness.finance_owner_email?.trim()
                    ),
                  },
                  {
                    label: 'Razão social e endereço completos',
                    ready: Boolean(
                      subscriptionReadiness.company_legal_name?.trim() &&
                        subscriptionReadiness.company_address?.trim()
                    ),
                  },
                  {
                    label: 'KYC marcado como pronto',
                    ready: subscriptionReadiness.kyc_status === 'ready',
                  },
                  {
                    label: 'Aceite interno de termos',
                    ready: subscriptionReadiness.terms_accepted,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800"
                  >
                    <span className="text-gray-700 dark:text-gray-200">{item.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.ready ? 'ready' : 'blocked')}`}>
                      {item.ready ? 'ready' : 'blocked'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
              <input
                type="checkbox"
                checked={subscriptionReadiness.terms_accepted}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionReadiness((current) => ({
                    ...current,
                    terms_accepted: event.target.checked,
                  }))
                }
              />
              <span>Aceite interno de termos/compliance marcado</span>
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Estado operacional da assinatura"
        subtitle="Fonte interna para status real da assinatura por organização, sem abrir cobrança externa nem sincronização real."
        right={
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${subscriptionStateTone(subscriptionState.status)}`}>
              {subscriptionState.status}
            </span>
            <button
              type="button"
              onClick={() => void saveSubscriptionState()}
              disabled={!writeEnabled || savingSubscriptionState}
              aria-busy={savingSubscriptionState}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {savingSubscriptionState ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar estado
            </button>
          </div>
        }
        className="p-4"
      >
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Status</span>
              <select
                value={subscriptionState.status}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    status: event.target.value as BillingSubscriptionState['status'],
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="inactive">inactive</option>
                <option value="sandbox">sandbox</option>
                <option value="trialing">trialing</option>
                <option value="active">active</option>
                <option value="past_due">past_due</option>
                <option value="paused">paused</option>
                <option value="canceled">canceled</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Provider operacional</span>
              <select
                value={subscriptionState.provider_code}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    provider_code: event.target.value as BillingSubscriptionState['provider_code'],
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="stripe">Stripe</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Plano em uso</span>
              <input
                value={subscriptionState.plan_slug || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    plan_slug: event.target.value || null,
                  }))
                }
                placeholder="strktr-pro"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Customer ref</span>
              <input
                value={subscriptionState.external_customer_ref || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    external_customer_ref: event.target.value || null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Subscription ref</span>
              <input
                value={subscriptionState.external_subscription_ref || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    external_subscription_ref: event.target.value || null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Último sync interno</span>
              <input
                type="datetime-local"
                value={toDatetimeLocal(subscriptionState.last_synced_at)}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    last_synced_at: fromDatetimeLocal(event.target.value),
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Período atual início</span>
              <input
                type="datetime-local"
                value={toDatetimeLocal(subscriptionState.current_period_start_at)}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    current_period_start_at: fromDatetimeLocal(event.target.value),
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Período atual fim</span>
              <input
                type="datetime-local"
                value={toDatetimeLocal(subscriptionState.current_period_end_at)}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    current_period_end_at: fromDatetimeLocal(event.target.value),
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Trial até</span>
              <input
                type="datetime-local"
                value={toDatetimeLocal(subscriptionState.trial_ends_at)}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    trial_ends_at: fromDatetimeLocal(event.target.value),
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Lançada em</span>
              <input
                type="datetime-local"
                value={toDatetimeLocal(subscriptionState.launched_at)}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    launched_at: fromDatetimeLocal(event.target.value),
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
              <input
                type="checkbox"
                checked={subscriptionState.auto_renew}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    auto_renew: event.target.checked,
                  }))
                }
              />
              <span>Auto renew habilitado</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
              <input
                type="checkbox"
                checked={subscriptionState.cancel_at_period_end}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    cancel_at_period_end: event.target.checked,
                  }))
                }
              />
              <span>Cancelar ao fim do período</span>
            </label>
            <label className="space-y-1 text-sm md:col-span-2 xl:col-span-3">
              <span className="text-gray-600 dark:text-gray-300">Notas operacionais</span>
              <textarea
                rows={3}
                value={subscriptionState.notes || ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setSubscriptionState((current) => ({
                    ...current,
                    notes: event.target.value || null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Status atual</p>
                <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{subscriptionState.status}</p>
                <p className="mt-1 text-sm text-gray-500">{subscriptionState.provider_code}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Plano</p>
                <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{subscriptionState.plan_slug || 'Não definido'}</p>
                <p className="mt-1 text-sm text-gray-500">{subscriptionState.auto_renew ? 'Renovação automática ativa' : 'Renovação manual/pausada'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Período corrente</p>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  {subscriptionState.current_period_start_at ? new Date(subscriptionState.current_period_start_at).toLocaleString('pt-BR') : 'Sem início'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {subscriptionState.current_period_end_at ? `até ${new Date(subscriptionState.current_period_end_at).toLocaleString('pt-BR')}` : 'Sem fim definido'}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Trial / Sync</p>
                <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  {subscriptionState.trial_ends_at ? `Trial até ${new Date(subscriptionState.trial_ends_at).toLocaleString('pt-BR')}` : 'Sem trial ativo'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {subscriptionState.last_synced_at ? `Sync ${new Date(subscriptionState.last_synced_at).toLocaleString('pt-BR')}` : 'Sem sync registrado'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Guardrails</h3>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  {
                    label: 'Somente sandbox/preview pode escrever',
                    ready: writeEnabled,
                  },
                  {
                    label: 'Provider operacional definido',
                    ready: Boolean(subscriptionState.provider_code),
                  },
                  {
                    label: 'Plano operacional definido',
                    ready: Boolean(subscriptionState.plan_slug?.trim()),
                  },
                  {
                    label: 'Referência externa documentada',
                    ready: Boolean(subscriptionState.external_subscription_ref?.trim()),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-800"
                  >
                    <span className="text-gray-700 dark:text-gray-200">{item.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.ready ? 'ready' : 'blocked')}`}>
                      {item.ready ? 'ready' : 'blocked'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Timeline operacional da assinatura"
        subtitle="Eventos internos append-only para acompanhar mudanças de status, trial, cobrança e overrides sem abrir integração real."
        right={
          <button
            type="button"
            onClick={() => void createSubscriptionEvent()}
            disabled={!writeEnabled || savingSubscriptionEvent || !subscriptionEventDraft.summary.trim()}
            aria-busy={savingSubscriptionEvent}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {savingSubscriptionEvent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Registrar evento
          </button>
        }
        className="p-4"
      >
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/20">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Tipo de evento</span>
                <select
                  value={subscriptionEventDraft.event_type}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setSubscriptionEventDraft((current) => ({
                      ...current,
                      event_type: event.target.value as BillingSubscriptionEvent['event_type'],
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="note">note</option>
                  <option value="status_changed">status_changed</option>
                  <option value="trial_started">trial_started</option>
                  <option value="trial_ended">trial_ended</option>
                  <option value="renewal_scheduled">renewal_scheduled</option>
                  <option value="renewed">renewed</option>
                  <option value="payment_failed">payment_failed</option>
                  <option value="paused">paused</option>
                  <option value="resumed">resumed</option>
                  <option value="canceled">canceled</option>
                  <option value="manual_override">manual_override</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Responsável</span>
                <input
                  value={subscriptionEventDraft.actor_label}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setSubscriptionEventDraft((current) => ({
                      ...current,
                      actor_label: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-gray-600 dark:text-gray-300">Resumo</span>
                <input
                  value={subscriptionEventDraft.summary}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setSubscriptionEventDraft((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  placeholder="Ex.: trial prorrogado internamente por 7 dias"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Status anterior</span>
                <select
                  value={subscriptionEventDraft.status_before || ''}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setSubscriptionEventDraft((current) => ({
                      ...current,
                      status_before: event.target.value ? (event.target.value as BillingSubscriptionEvent['status_before']) : null,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">sem valor</option>
                  <option value="inactive">inactive</option>
                  <option value="sandbox">sandbox</option>
                  <option value="trialing">trialing</option>
                  <option value="active">active</option>
                  <option value="past_due">past_due</option>
                  <option value="paused">paused</option>
                  <option value="canceled">canceled</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Status posterior</span>
                <select
                  value={subscriptionEventDraft.status_after || ''}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setSubscriptionEventDraft((current) => ({
                      ...current,
                      status_after: event.target.value ? (event.target.value as BillingSubscriptionEvent['status_after']) : null,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">sem valor</option>
                  <option value="inactive">inactive</option>
                  <option value="sandbox">sandbox</option>
                  <option value="trialing">trialing</option>
                  <option value="active">active</option>
                  <option value="past_due">past_due</option>
                  <option value="paused">paused</option>
                  <option value="canceled">canceled</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Provider</span>
                <select
                  value={subscriptionEventDraft.provider_code || ''}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setSubscriptionEventDraft((current) => ({
                      ...current,
                      provider_code: event.target.value ? (event.target.value as BillingSubscriptionEvent['provider_code']) : null,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">sem provider</option>
                  <option value="stripe">stripe</option>
                  <option value="mercadopago">mercadopago</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Data efetiva</span>
                <input
                  type="datetime-local"
                  value={subscriptionEventDraft.effective_at}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setSubscriptionEventDraft((current) => ({
                      ...current,
                      effective_at: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-gray-600 dark:text-gray-300">Detalhes</span>
                <textarea
                  rows={4}
                  value={subscriptionEventDraft.details}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setSubscriptionEventDraft((current) => ({
                      ...current,
                      details: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            {subscriptionEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-sm text-gray-500">
                Nenhum evento operacional registrado ainda.
              </div>
            ) : (
              subscriptionEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${subscriptionEventTone(event.event_type)}`}>
                          {event.event_type}
                        </span>
                        {event.provider_code ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                            {event.provider_code}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{event.summary}</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        {event.actor_label || 'Sem responsável'} · {new Date(event.effective_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(event.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  {(event.status_before || event.status_after) ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        {event.status_before || 'sem status'}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="rounded-full bg-slate-900 px-2 py-1 font-semibold text-white">
                        {event.status_after || 'sem status'}
                      </span>
                    </div>
                  ) : null}
                  {event.details ? (
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{event.details}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Configuração interna de checkout"
        subtitle="Write-capable apenas em development/preview. Produção permanece bloqueada até compliance fechar."
        right={
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(writeEnabled ? 'ready' : 'blocked')}`}>
              {writeEnabled ? `${runtimeStage}` : `${runtimeStage} bloqueado`}
            </span>
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={!writeEnabled || saving}
              aria-busy={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </button>
          </div>
        }
        className="p-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Provedor padrão</span>
            <select
              value={settings.default_provider}
              disabled={!writeEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, default_provider: event.target.value as BillingAdminSettings['default_provider'] }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="stripe">Stripe</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Email de cobrança</span>
            <input
              value={settings.billing_email || ''}
              disabled={!writeEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, billing_email: event.target.value || null }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Email de suporte</span>
            <input
              value={settings.support_email || ''}
              disabled={!writeEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, support_email: event.target.value || null }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">URL de termos</span>
            <input
              value={settings.terms_url || ''}
              disabled={!writeEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, terms_url: event.target.value || null }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">URL de privacidade</span>
            <input
              value={settings.privacy_url || ''}
              disabled={!writeEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, privacy_url: event.target.value || null }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Trial (dias)</span>
            <input
              type="number"
              min={0}
              max={90}
              value={settings.trial_days}
              disabled={!writeEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, trial_days: Number(event.target.value || 0) }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Preço mensal (R$)</span>
            <input
              value={moneyFromCents(settings.monthly_price_cents)}
              disabled={!writeEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, monthly_price_cents: centsFromMoney(event.target.value) }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Preço anual (R$)</span>
            <input
              value={moneyFromCents(settings.annual_price_cents)}
              disabled={!writeEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, annual_price_cents: centsFromMoney(event.target.value) }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
            <input
              type="checkbox"
              checked={settings.checkout_enabled}
              disabled={!writeEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, checkout_enabled: event.target.checked }))}
            />
            <span>Checkout interno habilitado para staging</span>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
            <input
              type="checkbox"
              checked={settings.sandbox_mode}
              disabled={!writeEnabled}
              onChange={(event) => setSettings((current) => ({ ...current, sandbox_mode: event.target.checked }))}
            />
            <span>Modo sandbox obrigatório</span>
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Checkout sandbox draft"
        subtitle="Preview interno do checkout antes de qualquer write real de assinatura ou cobrança."
        right={
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(checkoutDraft.mode === 'sandbox' ? 'ready' : 'setup_required')}`}>
              {checkoutDraft.mode}
            </span>
            <button
              type="button"
              onClick={() => void saveCheckoutDraft()}
              disabled={!writeEnabled || savingDraft}
              aria-busy={savingDraft}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {savingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar draft
            </button>
          </div>
        }
        className="p-4"
      >
        <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Slug do plano</span>
              <input
                value={checkoutDraft.plan_slug}
                disabled={!writeEnabled}
                onChange={(event) => setCheckoutDraft((current) => ({ ...current, plan_slug: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Modo</span>
              <select
                value={checkoutDraft.mode}
                disabled={!writeEnabled}
                onChange={(event) => setCheckoutDraft((current) => ({ ...current, mode: event.target.value as BillingCheckoutDraft['mode'] }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="disabled">disabled</option>
                <option value="sandbox">sandbox</option>
              </select>
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Headline</span>
              <input
                value={checkoutDraft.headline || ''}
                disabled={!writeEnabled}
                onChange={(event) => setCheckoutDraft((current) => ({ ...current, headline: event.target.value || null }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Subheadline</span>
              <textarea
                value={checkoutDraft.subheadline || ''}
                disabled={!writeEnabled}
                onChange={(event) => setCheckoutDraft((current) => ({ ...current, subheadline: event.target.value || null }))}
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">CTA principal</span>
              <input
                value={checkoutDraft.primary_cta_label || ''}
                disabled={!writeEnabled}
                onChange={(event) => setCheckoutDraft((current) => ({ ...current, primary_cta_label: event.target.value || null }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Moeda</span>
              <input
                value={checkoutDraft.currency}
                disabled={!writeEnabled}
                onChange={(event) => setCheckoutDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Preço mensal ({checkoutDraft.currency})</span>
              <input
                value={moneyFromCents(checkoutDraft.monthly_price_cents)}
                disabled={!writeEnabled}
                onChange={(event) => setCheckoutDraft((current) => ({ ...current, monthly_price_cents: centsFromMoney(event.target.value) }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Preço anual ({checkoutDraft.currency})</span>
              <input
                value={moneyFromCents(checkoutDraft.annual_price_cents)}
                disabled={!writeEnabled}
                onChange={(event) => setCheckoutDraft((current) => ({ ...current, annual_price_cents: centsFromMoney(event.target.value) }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Trial override (dias)</span>
              <input
                type="number"
                min={0}
                max={90}
                value={checkoutDraft.trial_days_override ?? ''}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setCheckoutDraft((current) => ({
                    ...current,
                    trial_days_override: event.target.value ? Number(event.target.value) : null,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Feature bullets</span>
              <textarea
                value={checkoutDraft.feature_bullets.join('\n')}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setCheckoutDraft((current) => ({
                    ...current,
                    feature_bullets: event.target.value
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                rows={5}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-gray-600 dark:text-gray-300">Notas internas</span>
              <textarea
                value={checkoutDraft.notes || ''}
                disabled={!writeEnabled}
                onChange={(event) => setCheckoutDraft((current) => ({ ...current, notes: event.target.value || null }))}
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Preview interno</p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  {checkoutDraft.headline || 'Sem headline'}
                </h3>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(checkoutDraft.mode === 'sandbox' ? 'ready' : 'setup_required')}`}>
                {checkoutDraft.mode}
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              {checkoutDraft.subheadline || 'Sem subheadline'}
            </p>
            <div className="mt-4 rounded-2xl bg-slate-950 px-4 py-4 text-white">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{checkoutDraft.plan_slug}</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-semibold">
                  {checkoutDraft.monthly_price_cents === null ? '--' : moneyFromCents(checkoutDraft.monthly_price_cents)}
                </span>
                <span className="text-sm text-slate-300">/mês</span>
              </div>
              {checkoutDraft.annual_price_cents !== null ? (
                <p className="mt-1 text-sm text-slate-300">
                  Anual: {moneyFromCents(checkoutDraft.annual_price_cents)} {checkoutDraft.currency}
                </p>
              ) : null}
              {checkoutDraft.trial_days_override !== null ? (
                <p className="mt-1 text-sm text-slate-300">{checkoutDraft.trial_days_override} dias de trial sandbox</p>
              ) : null}
              <button
                type="button"
                disabled
                className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 opacity-90"
              >
                {checkoutDraft.primary_cta_label || 'CTA principal'}
              </button>
            </div>
            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Features</p>
              <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                {checkoutDraft.feature_bullets.map((item, index) => (
                  <li key={`${item}-${index}`} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Catálogo interno de planos"
        subtitle="Fonte de verdade interna para pricing, trial e providers aceitos antes de abrir checkout real."
        className="p-4"
      >
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Novo plano interno</h3>
                <p className="mt-1 text-xs text-gray-500">Só sandbox/preview. Nenhuma cobrança real é aberta aqui.</p>
              </div>
              <button
                type="button"
                onClick={() => void createPlan()}
                disabled={!writeEnabled || savingPlan || !planDraft.slug.trim() || !planDraft.name.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {savingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Criar plano
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Slug</span>
                <input
                  value={planDraft.slug}
                  disabled={!writeEnabled}
                  onChange={(event) => setPlanDraft((current) => ({ ...current, slug: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Nome</span>
                <input
                  value={planDraft.name}
                  disabled={!writeEnabled}
                  onChange={(event) => setPlanDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Status</span>
                <select
                  value={planDraft.status}
                  disabled={!writeEnabled}
                  onChange={(event) => setPlanDraft((current) => ({ ...current, status: event.target.value as BillingPlanStatus }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Moeda</span>
                <input
                  value={planDraft.currency}
                  disabled={!writeEnabled}
                  onChange={(event) => setPlanDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Preço mensal</span>
                <input
                  value={moneyFromCents(planDraft.monthly_price_cents)}
                  disabled={!writeEnabled}
                  onChange={(event) => setPlanDraft((current) => ({ ...current, monthly_price_cents: centsFromMoney(event.target.value) }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Preço anual</span>
                <input
                  value={moneyFromCents(planDraft.annual_price_cents)}
                  disabled={!writeEnabled}
                  onChange={(event) => setPlanDraft((current) => ({ ...current, annual_price_cents: centsFromMoney(event.target.value) }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Trial (dias)</span>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={planDraft.trial_days}
                  disabled={!writeEnabled}
                  onChange={(event) => setPlanDraft((current) => ({ ...current, trial_days: Number(event.target.value || 0) }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
                <input
                  type="checkbox"
                  checked={planDraft.featured}
                  disabled={!writeEnabled}
                  onChange={(event) => setPlanDraft((current) => ({ ...current, featured: event.target.checked }))}
                />
                <span>Plano destacado no preview</span>
              </label>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(['stripe', 'mercadopago'] as const).map((provider) => (
                <label
                  key={`new-plan-${provider}`}
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-gray-800 dark:bg-gray-950"
                >
                  <input
                    type="checkbox"
                    checked={planDraft.accepted_providers.includes(provider)}
                    disabled={!writeEnabled}
                    onChange={(event) =>
                      setPlanDraft((current) => ({
                        ...current,
                        accepted_providers: event.target.checked
                          ? Array.from(new Set([...current.accepted_providers, provider]))
                          : current.accepted_providers.filter((item) => item !== provider),
                      }))
                    }
                  />
                  <span>{provider}</span>
                </label>
              ))}
            </div>

            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Descrição</span>
              <textarea
                value={planDraft.description}
                disabled={!writeEnabled}
                onChange={(event) => setPlanDraft((current) => ({ ...current, description: event.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Feature bullets</span>
              <textarea
                value={planDraft.feature_bullets.join('\n')}
                disabled={!writeEnabled}
                onChange={(event) =>
                  setPlanDraft((current) => ({
                    ...current,
                    feature_bullets: event.target.value
                      .split('\n')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                rows={4}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Notas</span>
              <textarea
                value={planDraft.notes}
                disabled={!writeEnabled}
                onChange={(event) => setPlanDraft((current) => ({ ...current, notes: event.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
          </div>

          <div className="space-y-3">
            {plans.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                Nenhum plano interno cadastrado ainda.
              </div>
            ) : (
              plans.map((plan) => (
                <div key={plan.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                      <p className="mt-1 text-xs text-gray-500">{plan.slug}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${planTone(plan.status)}`}>{plan.status}</span>
                      {plan.featured ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">featured</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Nome</span>
                      <input
                        value={plan.name}
                        disabled={!writeEnabled}
                        onChange={(event) =>
                          setPlans((current) => current.map((item) => (item.id === plan.id ? { ...item, name: event.target.value } : item)))
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Slug</span>
                      <input
                        value={plan.slug}
                        disabled={!writeEnabled}
                        onChange={(event) =>
                          setPlans((current) => current.map((item) => (item.id === plan.id ? { ...item, slug: event.target.value } : item)))
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Status</span>
                      <select
                        value={plan.status}
                        disabled={!writeEnabled}
                        onChange={(event) =>
                          setPlans((current) =>
                            current.map((item) => (item.id === plan.id ? { ...item, status: event.target.value as BillingPlanStatus } : item))
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="draft">draft</option>
                        <option value="active">active</option>
                        <option value="archived">archived</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Trial</span>
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={plan.trial_days}
                        disabled={!writeEnabled}
                        onChange={(event) =>
                          setPlans((current) =>
                            current.map((item) => (item.id === plan.id ? { ...item, trial_days: Number(event.target.value || 0) } : item))
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Preço mensal</span>
                      <input
                        value={moneyFromCents(plan.monthly_price_cents)}
                        disabled={!writeEnabled}
                        onChange={(event) =>
                          setPlans((current) =>
                            current.map((item) => (item.id === plan.id ? { ...item, monthly_price_cents: centsFromMoney(event.target.value) } : item))
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Preço anual</span>
                      <input
                        value={moneyFromCents(plan.annual_price_cents)}
                        disabled={!writeEnabled}
                        onChange={(event) =>
                          setPlans((current) =>
                            current.map((item) => (item.id === plan.id ? { ...item, annual_price_cents: centsFromMoney(event.target.value) } : item))
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(['stripe', 'mercadopago'] as const).map((provider) => (
                      <label
                        key={`${plan.id}:${provider}`}
                        className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm dark:border-gray-800 dark:bg-gray-900"
                      >
                        <input
                          type="checkbox"
                          checked={plan.accepted_providers.includes(provider)}
                          disabled={!writeEnabled}
                          onChange={(event) =>
                            setPlans((current) =>
                              current.map((item) =>
                                item.id === plan.id
                                  ? {
                                      ...item,
                                      accepted_providers: event.target.checked
                                        ? Array.from(new Set([...item.accepted_providers, provider]))
                                        : item.accepted_providers.filter((entry) => entry !== provider),
                                    }
                                  : item
                              )
                            )
                          }
                        />
                        <span>{provider}</span>
                      </label>
                    ))}
                  </div>

                  <label className="mt-3 block space-y-1 text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Descrição</span>
                    <textarea
                      value={plan.description || ''}
                      disabled={!writeEnabled}
                      onChange={(event) =>
                        setPlans((current) => current.map((item) => (item.id === plan.id ? { ...item, description: event.target.value || null } : item)))
                      }
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </label>
                  <label className="mt-3 block space-y-1 text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Feature bullets</span>
                    <textarea
                      value={plan.feature_bullets.join('\n')}
                      disabled={!writeEnabled}
                      onChange={(event) =>
                        setPlans((current) =>
                          current.map((item) =>
                            item.id === plan.id
                              ? {
                                  ...item,
                                  feature_bullets: event.target.value
                                    .split('\n')
                                    .map((entry) => entry.trim())
                                    .filter(Boolean),
                                }
                              : item
                          )
                        )
                      }
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </label>
                  <label className="mt-3 block space-y-1 text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Notas</span>
                    <textarea
                      value={plan.notes || ''}
                      disabled={!writeEnabled}
                      onChange={(event) =>
                        setPlans((current) => current.map((item) => (item.id === plan.id ? { ...item, notes: event.target.value || null } : item)))
                      }
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={plan.featured}
                        disabled={!writeEnabled}
                        onChange={(event) =>
                          setPlans((current) => current.map((item) => (item.id === plan.id ? { ...item, featured: event.target.checked } : item)))
                        }
                      />
                      Plano destacado
                    </label>
                    <button
                      type="button"
                      onClick={() => void savePlan(plan.id)}
                      disabled={!writeEnabled || busyPlanId === plan.id}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                    >
                      {busyPlanId === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Salvar plano
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-3 xl:grid-cols-2">
        {providers.map((provider) => {
          const providerSetting =
            providerSettings.find((item) => item.provider_code === provider.code) ||
            EMPTY_PROVIDER_SETTINGS.find((item) => item.provider_code === provider.code)!

          return (
          <SectionCard key={provider.code} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{provider.label}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(provider.setupState)}`}>{provider.setupState}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{provider.description}</p>
              </div>
              <div className={`text-xs font-semibold uppercase tracking-wide ${provider.riskLevel === 'high' ? 'text-red-600' : 'text-amber-600'}`}>risco {provider.riskLevel}</div>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-sand-200 bg-sand-50 px-3 py-3 text-sm text-sand-900 dark:border-sand-900/40 dark:bg-sand-950/20 dark:text-sand-100">
              <span className="font-semibold">Próximo passo:</span> {provider.recommendedAction}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {provider.envKeys.map((envKey) => (
                <span key={envKey} className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">{envKey}</span>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Status operacional</span>
                <select
                  value={providerSetting.operational_status}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setProviderSettings((current) =>
                      current.map((item) =>
                        item.provider_code === provider.code
                          ? {
                              ...item,
                              operational_status: event.target.value as BillingProviderSetting['operational_status'],
                            }
                          : item
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="planned">planned</option>
                  <option value="sandbox_ready">sandbox_ready</option>
                  <option value="beta_ready">beta_ready</option>
                  <option value="live_blocked">live_blocked</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Rollout mode</span>
                <select
                  value={providerSetting.rollout_mode}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setProviderSettings((current) =>
                      current.map((item) =>
                        item.provider_code === provider.code
                          ? {
                              ...item,
                              rollout_mode: event.target.value as BillingProviderSetting['rollout_mode'],
                            }
                          : item
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="internal">internal</option>
                  <option value="allowlist">allowlist</option>
                  <option value="closed_beta">closed_beta</option>
                  <option value="general_blocked">general_blocked</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Account reference</span>
                <input
                  value={providerSetting.account_reference || ''}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setProviderSettings((current) =>
                      current.map((item) =>
                        item.provider_code === provider.code
                          ? { ...item, account_reference: event.target.value || null }
                          : item
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Publishable key hint</span>
                <input
                  value={providerSetting.publishable_key_hint || ''}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setProviderSettings((current) =>
                      current.map((item) =>
                        item.provider_code === provider.code
                          ? { ...item, publishable_key_hint: event.target.value || null }
                          : item
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-gray-600 dark:text-gray-300">Webhook endpoint hint</span>
                <input
                  value={providerSetting.webhook_endpoint_hint || ''}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setProviderSettings((current) =>
                      current.map((item) =>
                        item.provider_code === provider.code
                          ? { ...item, webhook_endpoint_hint: event.target.value || null }
                          : item
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">País de liquidação</span>
                <input
                  value={providerSetting.settlement_country || ''}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setProviderSettings((current) =>
                      current.map((item) =>
                        item.provider_code === provider.code
                          ? { ...item, settlement_country: event.target.value.toUpperCase() || null }
                          : item
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Moedas aceitas</span>
                <input
                  value={providerSetting.accepted_currencies.join(', ')}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setProviderSettings((current) =>
                      current.map((item) =>
                        item.provider_code === provider.code
                          ? {
                              ...item,
                              accepted_currencies: event.target.value
                                .split(',')
                                .map((value) => value.trim().toUpperCase())
                                .filter(Boolean),
                            }
                          : item
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
                <input
                  type="checkbox"
                  checked={providerSetting.supports_cards}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setProviderSettings((current) =>
                      current.map((item) =>
                        item.provider_code === provider.code
                          ? { ...item, supports_cards: event.target.checked }
                          : item
                      )
                    )
                  }
                />
                <span>Suporta cartão</span>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
                <input
                  type="checkbox"
                  checked={providerSetting.supports_pix}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setProviderSettings((current) =>
                      current.map((item) =>
                        item.provider_code === provider.code
                          ? { ...item, supports_pix: event.target.checked }
                          : item
                      )
                    )
                  }
                />
                <span>Suporta PIX</span>
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-gray-600 dark:text-gray-300">Notas operacionais</span>
                <textarea
                  rows={3}
                  value={providerSetting.notes || ''}
                  disabled={!writeEnabled}
                  onChange={(event) =>
                    setProviderSettings((current) =>
                      current.map((item) =>
                        item.provider_code === provider.code
                          ? { ...item, notes: event.target.value || null }
                          : item
                      )
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void saveProvider(provider.code)}
                disabled={!writeEnabled || busyProviderCode === provider.code}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {busyProviderCode === provider.code ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Salvar provider
              </button>
            </div>
          </SectionCard>
          )
        })}
      </div>

      <SectionCard className="p-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Superfícies planejadas</h2>
        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          {surfaces.map((surface) => (
            <div key={surface.code} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{surface.label}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(surface.exposureState)}`}>{surface.exposureState}</span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{surface.description}</p>
              <p className="mt-3 text-sm text-sand-800 dark:text-sand-200"><span className="font-semibold">Próximo passo:</span> {surface.recommendedAction}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
