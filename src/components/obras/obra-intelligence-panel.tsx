'use client'

import { AlertTriangle, Building2, CloudRain, MapPin, Sparkles } from 'lucide-react'
import { fmt, fmtDate } from '@/lib/utils'
import type { RecommendedAction } from '@/shared/types/execution'
import type { ObraIntelligencePayload } from '@/shared/types/obra-intelligence'

interface ObraIntelligencePanelProps {
  payload: ObraIntelligencePayload | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onRunAction: (action: RecommendedAction) => void
}

function severityTone(value: 'low' | 'medium' | 'high') {
  if (value === 'high') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
  if (value === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
}

export function ObraIntelligencePanel({
  payload,
  loading,
  error,
  onRetry,
  onRunAction,
}: ObraIntelligencePanelProps) {
  if (loading) {
    return <div className="skeleton h-52 rounded-2xl" />
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (!payload) return null

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Sparkles className="h-3.5 w-3.5" />
            Inteligencia da obra
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Prioridade operacional, sinais externos e prontidão de execução.
          </p>
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${severityTone(payload.risk.level)}`}>
          Risco {payload.risk.level.toUpperCase()} · {payload.risk.score}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr_1fr]">
        <div className="rounded-2xl border border-sand-200 bg-sand-50/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sand-700">O que fazer agora</p>
          {payload.actionNow ? (
            <>
              <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{payload.actionNow.title}</p>
              {payload.actionNow.description && (
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{payload.actionNow.description}</p>
              )}
              <button
                type="button"
                onClick={() => onRunAction(payload.actionNow as RecommendedAction)}
                className="mt-3 rounded-lg bg-sand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sand-600"
              >
                {payload.actionNow.cta}
              </button>
            </>
          ) : (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
              Nenhuma ação crítica imediata. Continue acompanhando alertas e caixa.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Alertas</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-red-200 bg-red-50 px-2 py-2">
              <p className="text-lg font-semibold text-red-600">{payload.totals.high}</p>
              <p className="text-[10px] uppercase tracking-wide text-red-600">High</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2">
              <p className="text-lg font-semibold text-amber-600">{payload.totals.medium}</p>
              <p className="text-[10px] uppercase tracking-wide text-amber-600">Med</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2">
              <p className="text-lg font-semibold text-emerald-600">{payload.totals.low}</p>
              <p className="text-[10px] uppercase tracking-wide text-emerald-600">Low</p>
            </div>
          </div>
          {payload.alerts[0] && (
            <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${severityTone(payload.alerts[0].severity)}`}>
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                {payload.alerts[0].title}
              </div>
              {payload.alerts[0].message && <p className="mt-1 opacity-80">{payload.alerts[0].message}</p>}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Prontidão</p>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-gray-500" />
                Localização da obra
              </div>
              <span className={payload.readiness.obraLocationConfigured ? 'text-emerald-600' : 'text-amber-600'}>
                {payload.readiness.obraLocationConfigured ? 'OK' : 'Pendente'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-gray-500" />
                Sede da organização
              </div>
              <span className={payload.readiness.orgHqConfigured ? 'text-emerald-600' : 'text-amber-600'}>
                {payload.readiness.orgHqConfigured ? 'OK' : 'Pendente'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <CloudRain className="h-3.5 w-3.5 text-gray-500" />
                Clima externo
              </div>
              <span className={payload.readiness.weatherAvailable ? 'text-emerald-600' : 'text-gray-500'}>
                {payload.readiness.weatherAvailable ? 'Disponível' : 'Sem sinal'}
              </span>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-gray-200 px-3 py-2 text-xs dark:border-gray-800">
            <p className="font-semibold text-gray-900 dark:text-white">Financeiro da obra</p>
            <p className={`mt-1 text-sm font-semibold ${payload.context.finance.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmt(payload.context.finance.saldo)}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Receitas {fmt(payload.context.finance.receitas)} · Despesas {fmt(payload.context.finance.despesas)}
            </p>
          </div>
        </div>
      </div>

      {(payload.context.weather || payload.timeline.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 dark:border-gray-800 dark:bg-gray-900/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Clima</p>
            {payload.context.weather ? (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                <p>
                  {payload.context.weather.nextHighRiskAt
                    ? `Próximo risco alto em ${fmtDate(payload.context.weather.nextHighRiskAt)}.`
                    : payload.context.weather.hasMediumRisk
                      ? 'Há atenção climática moderada nos próximos dias.'
                      : 'Sem risco climático relevante na janela atual.'}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">
                  Forecast analisado: {payload.context.weather.forecastDays} dias.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-500">Sem forecast consolidado no momento.</p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/70 p-4 dark:border-gray-800 dark:bg-gray-900/40">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Últimas atualizações</p>
            {payload.timeline.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">Sem atualizações recentes no diário.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {payload.timeline.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-gray-200 px-3 py-2 text-xs dark:border-gray-800">
                    <p className="font-medium text-gray-900 dark:text-white">{entry.title}</p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {fmtDate(entry.created_at)} · {entry.type}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
