import { ok } from '@/lib/api/response'
import { withSuperAdminAuth } from '@/lib/super-admin/api'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type {
  BillingKycStatus,
  BillingSubscriptionStatus,
} from '@/shared/types/billing'
import type {
  SuperAdminBillingGovernanceOrg,
  SuperAdminBillingGovernancePayload,
  SuperAdminBillingGovernanceSummary,
} from '@/shared/types/super-admin'

type OrgRow = {
  id: string
  nome: string | null
}

type ReadinessRow = {
  org_id: string
  selected_plan_slug: string | null
  kyc_status: BillingKycStatus
  terms_accepted: boolean
}

type StateRow = {
  org_id: string
  status: BillingSubscriptionStatus
  last_synced_at: string | null
}

type EventRow = {
  org_id: string
  event_type: string
  effective_at: string
}

type ProviderRow = {
  org_id: string
  operational_status: string
}

type PlanRow = {
  org_id: string
  status: string
}

const EMPTY_SUMMARY: SuperAdminBillingGovernanceSummary = {
  serviceRoleReady: false,
  orgsTracked: 0,
  healthy: 0,
  attention: 0,
  blocked: 0,
  missingKyc: 0,
  termsPending: 0,
  pastDue: 0,
}

function latestIso(current: string | null, candidate: string | null) {
  if (!candidate) return current
  if (!current) return candidate
  return Date.parse(candidate) > Date.parse(current) ? candidate : current
}

export const GET = withSuperAdminAuth('can_manage_team', async (request) => {
  const service = createServiceRoleClient()

  if (!service) {
    return ok(request, { summary: EMPTY_SUMMARY, orgs: [] } satisfies SuperAdminBillingGovernancePayload)
  }

  const [readinessResult, stateResult, eventResult, providerResult, planResult] = await Promise.all([
    service.from('billing_subscription_readiness').select('org_id, selected_plan_slug, kyc_status, terms_accepted'),
    service.from('billing_subscription_states').select('org_id, status, last_synced_at'),
    service.from('billing_subscription_events').select('org_id, event_type, effective_at').order('effective_at', { ascending: false }).limit(100),
    service.from('billing_provider_settings').select('org_id, operational_status'),
    service.from('billing_plan_catalog').select('org_id, status').limit(100),
  ])

  const orgIds = new Set<string>()
  for (const row of ((readinessResult.data || []) as ReadinessRow[])) orgIds.add(row.org_id)
  for (const row of ((stateResult.data || []) as StateRow[])) orgIds.add(row.org_id)
  for (const row of ((eventResult.data || []) as EventRow[])) orgIds.add(row.org_id)
  for (const row of ((providerResult.data || []) as ProviderRow[])) orgIds.add(row.org_id)
  for (const row of ((planResult.data || []) as PlanRow[])) orgIds.add(row.org_id)

  const orgIdList = Array.from(orgIds)
  const orgsResult =
    orgIdList.length > 0
      ? await service.from('organizacoes').select('id, nome').in('id', orgIdList).limit(100)
      : { data: [] as OrgRow[] }

  const orgNameById = new Map<string, string | null>(
    (((orgsResult.data || []) as OrgRow[]).map((row) => [row.id, row.nome || null]))
  )

  const readinessByOrg = new Map<string, ReadinessRow>()
  for (const row of ((readinessResult.data || []) as ReadinessRow[])) readinessByOrg.set(row.org_id, row)

  const stateByOrg = new Map<string, StateRow>()
  for (const row of ((stateResult.data || []) as StateRow[])) stateByOrg.set(row.org_id, row)

  const latestEventByOrg = new Map<string, EventRow>()
  for (const row of ((eventResult.data || []) as EventRow[])) {
    if (!latestEventByOrg.has(row.org_id)) latestEventByOrg.set(row.org_id, row)
  }

  const providerReadyCountByOrg = new Map<string, number>()
  for (const row of ((providerResult.data || []) as ProviderRow[])) {
    const current = providerReadyCountByOrg.get(row.org_id) || 0
    const ready = row.operational_status === 'sandbox_ready' || row.operational_status === 'beta_ready' ? 1 : 0
    providerReadyCountByOrg.set(row.org_id, current + ready)
  }

  const activePlanCountByOrg = new Map<string, number>()
  for (const row of ((planResult.data || []) as PlanRow[])) {
    const current = activePlanCountByOrg.get(row.org_id) || 0
    activePlanCountByOrg.set(row.org_id, current + (row.status === 'active' ? 1 : 0))
  }

  const items: SuperAdminBillingGovernanceOrg[] = orgIdList.map((orgId) => {
    const readiness = readinessByOrg.get(orgId)
    const state = stateByOrg.get(orgId)
    const latestEvent = latestEventByOrg.get(orgId)
    const blockers: string[] = []
    const warnings: string[] = []
    const providerReadyCount = providerReadyCountByOrg.get(orgId) || 0
    const activePlanCount = activePlanCountByOrg.get(orgId) || 0

    if (providerReadyCount === 0) blockers.push('Sem provider pronto para sandbox/beta')
    if (!readiness?.selected_plan_slug) blockers.push('Sem plano selecionado')
    if (activePlanCount === 0) blockers.push('Sem plano ativo no catálogo')
    if ((readiness?.kyc_status || 'not_started') !== 'ready') blockers.push('KYC não está pronto')
    if (!readiness?.terms_accepted) blockers.push('Termos internos pendentes')

    if (state?.status === 'past_due') warnings.push('Assinatura em past_due')
    if (state?.status === 'paused') warnings.push('Assinatura pausada')
    if (!state?.last_synced_at && state?.status && state.status !== 'inactive') warnings.push('Sem sync recente')
    if (latestEvent?.event_type === 'payment_failed') warnings.push('Último evento foi payment_failed')

    return {
      org_id: orgId,
      org_name: orgNameById.get(orgId) || null,
      status: blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'attention' : 'healthy',
      blockers,
      warnings,
      provider_ready_count: providerReadyCount,
      active_plan_count: activePlanCount,
      selected_plan_slug: readiness?.selected_plan_slug || null,
      kyc_status: readiness?.kyc_status || 'not_started',
      terms_accepted: readiness?.terms_accepted || false,
      subscription_status: state?.status || 'inactive',
      last_event_at: latestEvent?.effective_at || null,
      last_sync_at: state?.last_synced_at || null,
    }
  })

  items.sort((a, b) => {
    const weight = (value: SuperAdminBillingGovernanceOrg['status']) =>
      value === 'blocked' ? 2 : value === 'attention' ? 1 : 0
    const delta = weight(b.status) - weight(a.status)
    if (delta !== 0) return delta
    return Date.parse(latestIso(null, b.last_event_at) || '1970-01-01') - Date.parse(latestIso(null, a.last_event_at) || '1970-01-01')
  })

  const summary: SuperAdminBillingGovernanceSummary = {
    serviceRoleReady: true,
    orgsTracked: items.length,
    healthy: items.filter((item) => item.status === 'healthy').length,
    attention: items.filter((item) => item.status === 'attention').length,
    blocked: items.filter((item) => item.status === 'blocked').length,
    missingKyc: items.filter((item) => item.kyc_status !== 'ready').length,
    termsPending: items.filter((item) => !item.terms_accepted).length,
    pastDue: items.filter((item) => item.subscription_status === 'past_due').length,
  }

  return ok(request, { summary, orgs: items } satisfies SuperAdminBillingGovernancePayload)
})
