'use client'

import { useCallback, useEffect, useState } from 'react'
import { Database, MapPinned, RefreshCcw, ShieldCheck, Telescope } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequestWithMeta } from '@/lib/api/client'
import type {
  BigDataChecklistItem,
  BigDataReadinessSummary,
  BigDataSurface,
} from '@/shared/types/big-data'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'

type Meta = {
  summary?: BigDataReadinessSummary
  checklist?: BigDataChecklistItem[]
}

const EMPTY_SUMMARY: BigDataReadinessSummary = {
  totalSurfaces: 0,
  internalOnly: 0,
  betaReady: 0,
  setupRequired: 0,
  planned: 0,
  complianceGated: 0,
  checklistReady: 0,
  checklistBlocked: 0,
}

function tone(value: string) {
  if (value === 'ready' || value === 'beta_ready' || value === 'internal_only') {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (value === 'blocked') return 'bg-red-100 text-red-700'
  if (value === 'setup_required') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-700'
}

export function BigDataOverviewContent() {
  const [items, setItems] = useState<BigDataSurface[]>([])
  const [summary, setSummary] = useState<BigDataReadinessSummary>(EMPTY_SUMMARY)
  const [checklist, setChecklist] = useState<BigDataChecklistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await apiRequestWithMeta<BigDataSurface[], Meta>('/api/v1/big-data/readiness')
      setItems(payload.data)
      setSummary(payload.meta?.summary || EMPTY_SUMMARY)
      setChecklist(payload.meta?.checklist || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar readiness de big data'
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
          title="Big Data"
          subtitle="Readiness interno para insights agregados e seguros"
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
          icon={<Database className="h-5 w-5 text-sand-600" />}
          title="Nenhuma superfície de big data mapeada"
          description="Assim que o domínio estiver pronto, esta tela mostrará bloqueios, risco e próximos passos."
          actionLabel="Atualizar"
          onAction={() => void refresh()}
        />
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isLoading}>
      <PageHeader
        title="Big Data"
        subtitle="Readiness interno para insights agregados sem abrir dados sensíveis ou cross-tenant reais"
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
            <Database className="h-3.5 w-3.5" />
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
            <MapPinned className="h-3.5 w-3.5" />
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
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Checklist mínimo para abrir insights agregados
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Esta tela não lê dados globais reais. Ela só mostra readiness, risco e bloqueios do domínio.
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
