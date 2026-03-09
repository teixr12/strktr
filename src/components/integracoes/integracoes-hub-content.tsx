'use client'

import { useEffect, useMemo, useState } from 'react'
import { Cable, CreditCard, Loader2, Mail, RefreshCcw, Save, ShieldCheck, Webhook } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import type {
  IntegrationHubCategory,
  IntegrationHubCode,
  IntegrationHubItem,
  IntegrationHubProviderSetting,
  IntegrationHubSettingsPayload,
  IntegrationHubSummary,
} from '@/shared/types/integrations-hub'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'

interface Meta {
  summary?: IntegrationHubSummary
}

const CATEGORY_LABELS: Record<IntegrationHubCategory, string> = {
  communication: 'Comunicação',
  calendar: 'Calendário',
  analytics: 'Analytics',
  billing: 'Billing',
  documents: 'Documentos',
  automation: 'Automação',
  finance: 'Financeiro',
}

function toneClass(configured: boolean) {
  return configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
}

function riskClass(risk: IntegrationHubItem['riskLevel']) {
  if (risk === 'high') return 'text-red-600'
  if (risk === 'medium') return 'text-amber-600'
  return 'text-emerald-600'
}

function statusTone(value: IntegrationHubProviderSetting['status']) {
  if (value === 'configured') return 'bg-emerald-100 text-emerald-700'
  if (value === 'blocked') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

function rolloutTone(value: IntegrationHubProviderSetting['rollout_mode']) {
  if (value === 'live') return 'bg-emerald-100 text-emerald-700'
  if (value === 'beta') return 'bg-blue-100 text-blue-700'
  if (value === 'sandbox') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-700'
}

export function IntegracoesHubContent() {
  const [items, setItems] = useState<IntegrationHubItem[]>([])
  const [summary, setSummary] = useState<IntegrationHubSummary>({
    total: 0,
    configured: 0,
    setupRequired: 0,
    communication: 0,
    billing: 0,
    analytics: 0,
  })
  const [settings, setSettings] = useState<IntegrationHubProviderSetting[]>([])
  const [writeEnabled, setWriteEnabled] = useState(false)
  const [runtimeStage, setRuntimeStage] = useState<'development' | 'preview' | 'production' | 'unknown'>('unknown')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<'all' | IntegrationHubCategory>('all')
  const [busyProviderCode, setBusyProviderCode] = useState<string | null>(null)

  const visibleItems = useMemo(() => {
    if (categoryFilter === 'all') return items
    return items.filter((item) => item.category === categoryFilter)
  }, [categoryFilter, items])

  const settingsByCode = useMemo(
    () => new Map(settings.map((item) => [item.provider_code, item])),
    [settings]
  )

  async function refresh() {
    setIsLoading(true)
    setError(null)
    try {
      const [payload, settingsPayload] = await Promise.all([
        apiRequestWithMeta<IntegrationHubItem[], Meta>('/api/v1/integrations/hub'),
        apiRequest<IntegrationHubSettingsPayload>('/api/v1/integrations/hub/settings'),
      ])
      setItems(payload.data)
      setSummary(
        payload.meta?.summary || {
          total: payload.data.length,
          configured: payload.data.filter((item) => item.configured).length,
          setupRequired: payload.data.filter((item) => !item.configured).length,
          communication: payload.data.filter((item) => item.category === 'communication').length,
          billing: payload.data.filter((item) => item.category === 'billing').length,
          analytics: payload.data.filter((item) => item.category === 'analytics').length,
        }
      )
      setSettings(settingsPayload.settings)
      setWriteEnabled(settingsPayload.writeEnabled)
      setRuntimeStage(settingsPayload.runtimeStage)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar hub de integrações'
      setError(message)
      toast(message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function updateLocalSetting(providerCode: string, updates: Partial<IntegrationHubProviderSetting>) {
    setSettings((current) =>
      current.map((item) => (item.provider_code === providerCode ? { ...item, ...updates } : item))
    )
  }

  async function saveProvider(providerCode: IntegrationHubCode) {
    const provider = settingsByCode.get(providerCode)
    if (!provider) return
    setBusyProviderCode(providerCode)
    try {
      const payload = await apiRequest<IntegrationHubSettingsPayload>('/api/v1/integrations/hub/settings', {
        method: 'PATCH',
        body: {
          provider_code: provider.provider_code,
          enabled: provider.enabled,
          status: provider.status,
          rollout_mode: provider.rollout_mode,
          owner_email: provider.owner_email,
          callback_url: provider.callback_url,
          notes: provider.notes,
        },
      })
      setSettings(payload.settings)
      setWriteEnabled(payload.writeEnabled)
      setRuntimeStage(payload.runtimeStage)
      toast('Configuração interna da integração atualizada', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar integração'
      toast(message, 'error')
    } finally {
      setBusyProviderCode(null)
    }
  }

  if (!isLoading && items.length === 0) {
    return (
      <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
        <PageHeader
          title="Integrações"
          subtitle="Visão central das integrações da organização"
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
          icon={<Cable className="h-5 w-5 text-sand-600" />}
          title="Nenhuma integração encontrada"
          description="Assim que as credenciais forem configuradas, o hub mostrará status, risco e próximos passos por provedor."
          actionLabel="Atualizar"
          onAction={() => void refresh()}
        />
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
      <PageHeader
        title="Integrações"
        subtitle={`${summary.total} integrações monitoradas no hub`}
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
            <Cable className="h-3.5 w-3.5" />Total
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.total}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5" />Prontas
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.configured}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Mail className="h-3.5 w-3.5" />Comunicação
          </div>
          <p className="mt-2 text-2xl font-semibold text-blue-600">{summary.communication}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <CreditCard className="h-3.5 w-3.5" />Billing
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{summary.billing}</p>
        </SectionCard>
      </div>

      <SectionCard className="p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`rounded-xl px-3 py-2 text-xs font-semibold ${categoryFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300'}`}
          >
            Todas
          </button>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategoryFilter(value as IntegrationHubCategory)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${categoryFilter === value ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </SectionCard>

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

      <SectionCard
        title="Governança interna por provider"
        subtitle="Write-capable apenas em development/preview. Produção continua bloqueada até a fase de connector real."
        right={
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${writeEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {writeEnabled ? `${runtimeStage}` : `${runtimeStage} bloqueado`}
          </span>
        }
        className="p-4"
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleItems.map((item) => {
            const setting = settingsByCode.get(item.code)
            return (
              <SectionCard key={item.code} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{item.label}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass(item.configured)}`}>
                        {item.configured ? 'Configurada' : 'Setup required'}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                        {CATEGORY_LABELS[item.category]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{item.description}</p>
                  </div>
                  <div className={`text-xs font-semibold uppercase tracking-wide ${riskClass(item.riskLevel)}`}>
                    risco {item.riskLevel}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Próximo passo</p>
                    <p className="mt-1 font-medium text-gray-900 dark:text-white">{item.recommendedAction}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                    <p className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-500">
                      <Webhook className="h-3.5 w-3.5" />Chaves esperadas
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.envKeys.map((key) => (
                        <code key={key} className="rounded bg-white px-2 py-1 text-[11px] text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                          {key}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>

                {setting ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Rollout interno</span>
                      <select
                        value={setting.rollout_mode}
                        disabled={!writeEnabled}
                        onChange={(event) =>
                          updateLocalSetting(item.code, {
                            rollout_mode: event.target.value as IntegrationHubProviderSetting['rollout_mode'],
                          })
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="disabled">disabled</option>
                        <option value="sandbox">sandbox</option>
                        <option value="beta">beta</option>
                        <option value="live">live</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Status interno</span>
                      <select
                        value={setting.status}
                        disabled={!writeEnabled}
                        onChange={(event) =>
                          updateLocalSetting(item.code, {
                            status: event.target.value as IntegrationHubProviderSetting['status'],
                          })
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="draft">draft</option>
                        <option value="configured">configured</option>
                        <option value="blocked">blocked</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Owner operacional</span>
                      <input
                        value={setting.owner_email || ''}
                        disabled={!writeEnabled}
                        onChange={(event) => updateLocalSetting(item.code, { owner_email: event.target.value || null })}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        placeholder="owner@empresa.com"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">Callback URL</span>
                      <input
                        value={setting.callback_url || ''}
                        disabled={!writeEnabled}
                        onChange={(event) => updateLocalSetting(item.code, { callback_url: event.target.value || null })}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        placeholder="https://..."
                      />
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-3 text-sm dark:border-gray-700 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={setting.enabled}
                        disabled={!writeEnabled}
                        onChange={(event) => updateLocalSetting(item.code, { enabled: event.target.checked })}
                      />
                      <span className="text-gray-700 dark:text-gray-200">Provider habilitado internamente</span>
                    </label>
                    <label className="space-y-1 text-sm md:col-span-2">
                      <span className="text-gray-600 dark:text-gray-300">Notas internas</span>
                      <textarea
                        value={setting.notes || ''}
                        disabled={!writeEnabled}
                        onChange={(event) => updateLocalSetting(item.code, { notes: event.target.value || null })}
                        rows={3}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        placeholder="Checklist interno, dependências, observações..."
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(setting.status)}`}>{setting.status}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${rolloutTone(setting.rollout_mode)}`}>{setting.rollout_mode}</span>
                      <button
                        type="button"
                        onClick={() => void saveProvider(item.code)}
                        disabled={!writeEnabled || busyProviderCode === item.code}
                        aria-busy={busyProviderCode === item.code}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                      >
                        {busyProviderCode === item.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Salvar governança
                      </button>
                    </div>
                  </div>
                ) : null}
              </SectionCard>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}
