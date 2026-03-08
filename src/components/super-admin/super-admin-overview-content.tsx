'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCcw, ShieldCheck, Telescope, TowerControl } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import type {
  SuperAdminBillingGovernancePayload,
  SuperAdminBillingGovernanceSummary,
  SuperAdminBillingGovernanceOrg,
  SuperAdminComplianceGatesPayload,
  SuperAdminComplianceGateModule,
  SuperAdminComplianceGateSummary,
  SuperAdminChecklistItem,
  SuperAdminDomainHealthItem,
  SuperAdminDomainHealthPayload,
  SuperAdminDomainHealthSummary,
  SuperAdminReadinessSummary,
  SuperAdminRolloutGovernanceModule,
  SuperAdminRolloutGovernancePayload,
  SuperAdminRolloutGovernanceSummary,
  SuperAdminSurface,
} from '@/shared/types/super-admin'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'

type Meta = {
  summary?: SuperAdminReadinessSummary
  checklist?: SuperAdminChecklistItem[]
}

const EMPTY_SUMMARY: SuperAdminReadinessSummary = {
  totalSurfaces: 0,
  internalOnly: 0,
  betaReady: 0,
  setupRequired: 0,
  planned: 0,
  complianceGated: 0,
  checklistReady: 0,
  checklistBlocked: 0,
}

const EMPTY_BILLING_SUMMARY: SuperAdminBillingGovernanceSummary = {
  serviceRoleReady: false,
  orgsTracked: 0,
  healthy: 0,
  attention: 0,
  blocked: 0,
  missingKyc: 0,
  termsPending: 0,
  pastDue: 0,
}

const EMPTY_ROLLOUT_SUMMARY: SuperAdminRolloutGovernanceSummary = {
  totalModules: 0,
  liveModules: 0,
  canaryModules: 0,
  allowlistModules: 0,
  blockedModules: 0,
  offModules: 0,
  complianceGatedModules: 0,
  complianceGatedNotLive: 0,
}

const EMPTY_DOMAIN_HEALTH_SUMMARY: SuperAdminDomainHealthSummary = {
  healthy: 0,
  attention: 0,
  blocked: 0,
}

const EMPTY_COMPLIANCE_SUMMARY: SuperAdminComplianceGateSummary = {
  totalRegulatedModules: 0,
  ready: 0,
  attention: 0,
  blocked: 0,
  safelyContained: 0,
  liveWithOpenBlockers: 0,
}

function tone(value: string) {
  if (value === 'ready' || value === 'beta_ready' || value === 'internal_only') {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (value === 'live') return 'bg-emerald-100 text-emerald-700'
  if (value === 'allowlist') return 'bg-sky-100 text-sky-700'
  if (value === 'canary' || value === 'attention' || value === 'setup_required' || value === 'in_progress') {
    return 'bg-amber-100 text-amber-700'
  }
  if (value === 'blocked') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

export function SuperAdminOverviewContent() {
  const [items, setItems] = useState<SuperAdminSurface[]>([])
  const [summary, setSummary] = useState<SuperAdminReadinessSummary>(EMPTY_SUMMARY)
  const [billingSummary, setBillingSummary] = useState<SuperAdminBillingGovernanceSummary>(EMPTY_BILLING_SUMMARY)
  const [billingOrgs, setBillingOrgs] = useState<SuperAdminBillingGovernanceOrg[]>([])
  const [rolloutSummary, setRolloutSummary] = useState<SuperAdminRolloutGovernanceSummary>(EMPTY_ROLLOUT_SUMMARY)
  const [rolloutModules, setRolloutModules] = useState<SuperAdminRolloutGovernanceModule[]>([])
  const [domainHealthSummary, setDomainHealthSummary] = useState<SuperAdminDomainHealthSummary>(
    EMPTY_DOMAIN_HEALTH_SUMMARY
  )
  const [domainHealthItems, setDomainHealthItems] = useState<SuperAdminDomainHealthItem[]>([])
  const [complianceSummary, setComplianceSummary] = useState<SuperAdminComplianceGateSummary>(
    EMPTY_COMPLIANCE_SUMMARY
  )
  const [complianceModules, setComplianceModules] = useState<SuperAdminComplianceGateModule[]>([])
  const [checklist, setChecklist] = useState<SuperAdminChecklistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [payload, billingPayload, rolloutPayload, domainHealthPayload, compliancePayload] = await Promise.all([
        apiRequestWithMeta<SuperAdminSurface[], Meta>('/api/v1/super-admin/readiness'),
        apiRequest<SuperAdminBillingGovernancePayload>('/api/v1/super-admin/billing-governance'),
        apiRequest<SuperAdminRolloutGovernancePayload>('/api/v1/super-admin/rollout-governance'),
        apiRequest<SuperAdminDomainHealthPayload>('/api/v1/super-admin/domain-health'),
        apiRequest<SuperAdminComplianceGatesPayload>('/api/v1/super-admin/compliance-gates'),
      ])
      setItems(payload.data)
      setSummary(payload.meta?.summary || EMPTY_SUMMARY)
      setChecklist(payload.meta?.checklist || [])
      setBillingSummary(billingPayload.summary)
      setBillingOrgs(billingPayload.orgs)
      setRolloutSummary(rolloutPayload.summary)
      setRolloutModules(rolloutPayload.modules)
      setDomainHealthSummary(domainHealthPayload.summary)
      setDomainHealthItems(domainHealthPayload.domains)
      setComplianceSummary(compliancePayload.summary)
      setComplianceModules(compliancePayload.modules)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar readiness de super admin'
      setError(message)
      toast(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!isLoading && items.length === 0) {
    return (
      <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
        <PageHeader
          title="Super Admin"
          subtitle="Readiness interno para governança global"
          actions={
            <QuickActionBar
              actions={[
                {
                  label: 'Atualizar',
                  icon: <RefreshCcw className="h-4 w-4" />,
                  onClick: () => void refresh(),
                },
              ]}
            />
          }
        />
        <EmptyStateAction
          icon={<TowerControl className="h-5 w-5 text-sand-600" />}
          title="Nenhuma superfície de super-admin mapeada"
          description="Assim que o readiness global estiver calculado, esta tela exibirá bloqueios, risco e próximos passos."
          actionLabel="Atualizar"
          onAction={() => void refresh()}
        />
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
      <PageHeader
        title="Super Admin"
        subtitle="Readiness interno para governança global sem abrir write cross-tenant"
        actions={
          <QuickActionBar
            actions={[
              {
                label: 'Atualizar',
                icon: <RefreshCcw className="h-4 w-4" />,
                onClick: () => void refresh(),
              },
            ]}
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <TowerControl className="h-3.5 w-3.5" />
            Superfícies
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.totalSurfaces}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compliance gated
          </div>
          <p className="mt-2 text-2xl font-semibold text-red-600">{summary.complianceGated}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Telescope className="h-3.5 w-3.5" />
            Beta ready
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.betaReady}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <RefreshCcw className="h-3.5 w-3.5" />
            Setup required
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{summary.setupRequired}</p>
        </SectionCard>
      </div>

      {error ? (
        <SectionCard className="border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
            >
              Tentar novamente
            </button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Saúde operacional por domínio</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Consolida runtime, analytics e o estado dos pods do programa em uma leitura executiva única.
            </p>
          </div>
          <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            {domainHealthSummary.healthy} healthy · {domainHealthSummary.attention} attention · {domainHealthSummary.blocked} blocked
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {domainHealthItems.map((item) => (
            <div
              key={item.code}
              className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.summary}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                {item.checks.map((check) => (
                  <div key={check.key} className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-900 dark:text-white">{check.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(check.ok ? 'ready' : 'blocked')}`}>
                        {check.ok ? 'ok' : 'blocked'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">{check.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Governança de rollout por domínio</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Mostra o estado real de rollout, canário e bloqueio de compliance dos módulos do programa.
            </p>
          </div>
          <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            {rolloutSummary.liveModules} live / {rolloutSummary.totalModules} módulos
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Canary</p>
            <p className="mt-1 font-medium text-amber-600">{rolloutSummary.canaryModules}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Allowlist</p>
            <p className="mt-1 font-medium text-sky-700">{rolloutSummary.allowlistModules}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Blocked</p>
            <p className="mt-1 font-medium text-red-600">{rolloutSummary.blockedModules}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Off</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{rolloutSummary.offModules}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Compliance gated</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{rolloutSummary.complianceGatedModules}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Gated não-live</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">
              {rolloutSummary.complianceGatedNotLive}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {rolloutModules.slice(0, 10).map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.rolloutState)}`}>
                      {item.rolloutState}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.deliveryState)}`}>
                      {item.deliveryState}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {item.podTitle} · risco {item.riskLevel}
                    {item.requiresComplianceGate ? ' · compliance gated' : ''}
                  </p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>flag {item.featureEnabled ? 'on' : 'off'}</div>
                  <div>
                    {item.rolloutConfigured
                      ? `${item.rolloutPercent}% · allowlist ${item.allowlistCount}`
                      : 'sem canário explícito'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Compliance gates dos domínios regulados</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Resume o que ainda bloqueia billing, API pública, super-admin global, agents, big data e open banking.
            </p>
          </div>
          <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            {complianceSummary.ready} ready · {complianceSummary.attention} attention · {complianceSummary.blocked} blocked
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Regulados</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{complianceSummary.totalRegulatedModules}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Ready</p>
            <p className="mt-1 font-medium text-emerald-600">{complianceSummary.ready}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Attention</p>
            <p className="mt-1 font-medium text-amber-600">{complianceSummary.attention}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Blocked</p>
            <p className="mt-1 font-medium text-red-600">{complianceSummary.blocked}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Contidos</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{complianceSummary.safelyContained}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {complianceModules.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.status)}`}>
                      {item.status}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.rolloutState)}`}>
                      {item.rolloutState}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {item.podTitle} · risco {item.riskLevel} · blockers {item.blockerCount} · warnings {item.warningCount}
                  </p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.gateReason}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                {item.checks.map((check) => (
                  <div key={check.key} className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-900 dark:text-white">{check.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          check.ok
                            ? tone('ready')
                            : check.severity === 'blocker'
                              ? tone('blocked')
                              : tone('attention')
                        }`}
                      >
                        {check.ok ? 'ok' : check.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">{check.detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-dashed border-sand-200 bg-sand-50 px-3 py-3 text-sm text-sand-900 dark:border-sand-900/40 dark:bg-sand-950/20 dark:text-sand-100">
                <span className="font-semibold">Próximo passo:</span> {item.recommendedAction}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Billing governance cross-tenant</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Visão global read-only de blockers e warnings de cobrança por organização.
            </p>
          </div>
          <div
            className={`rounded-xl px-3 py-2 text-xs font-semibold ${
              billingSummary.serviceRoleReady ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {billingSummary.serviceRoleReady ? 'service role ready' : 'service role ausente'}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Orgs</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{billingSummary.orgsTracked}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Healthy</p>
            <p className="mt-1 font-medium text-emerald-600">{billingSummary.healthy}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Attention</p>
            <p className="mt-1 font-medium text-amber-600">{billingSummary.attention}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Blocked</p>
            <p className="mt-1 font-medium text-red-600">{billingSummary.blocked}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">KYC pendente</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{billingSummary.missingKyc}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Past due</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">{billingSummary.pastDue}</p>
          </div>
        </div>

        {billingSummary.serviceRoleReady ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {billingOrgs.slice(0, 8).map((item) => (
              <div
                key={item.org_id}
                className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {item.org_name || item.org_id}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Provider ready {item.provider_ready_count} · planos ativos {item.active_plan_count} · assinatura{' '}
                      {item.subscription_status}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>{item.selected_plan_slug || 'sem plano'}</div>
                    <div>{item.last_event_at ? new Date(item.last_event_at).toLocaleString('pt-BR') : 'sem evento'}</div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-xl bg-red-50 px-3 py-3 text-sm text-red-700">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4" />
                      Blockers
                    </div>
                    {item.blockers.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {item.blockers.slice(0, 3).map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2">Sem blockers ativos</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-700">
                    <div className="font-semibold">Warnings</div>
                    {item.warnings.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {item.warnings.slice(0, 3).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2">Sem warnings ativos</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            O helper de service role não está pronto neste ambiente. O painel global de billing continua bloqueado.
          </div>
        )}
      </SectionCard>

      <SectionCard className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Checklist mínimo para governança global
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Esta tela não abre acesso global real. Ela só mostra o que já existe e o que ainda bloqueia
              o domínio.
            </p>
          </div>
          <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            {summary.checklistReady} pronto(s) / {summary.checklistBlocked} bloqueado(s)
          </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {checklist.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-3 xl:grid-cols-2">
        {items.map((item) => (
          <SectionCard key={item.code} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone(item.exposureState)}`}>
                    {item.exposureState}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
              </div>
              <div
                className={`text-xs font-semibold uppercase tracking-wide ${
                  item.riskLevel === 'high' ? 'text-red-600' : 'text-amber-600'
                }`}
              >
                risco {item.riskLevel}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-sand-200 bg-sand-50 px-3 py-3 text-sm text-sand-900 dark:border-sand-900/40 dark:bg-sand-950/20 dark:text-sand-100">
              <span className="font-semibold">Próximo passo:</span> {item.recommendedAction}
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  )
}
