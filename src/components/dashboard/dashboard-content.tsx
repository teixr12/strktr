'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { Obra, Lead, Transacao, Visita, Orcamento, Compra, Projeto } from '@/types/database'
import { apiRequest } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { fmt, fmtDateTime } from '@/lib/utils'
import { KANBAN_COLUMNS, TIPO_VISITA_COLORS } from '@/lib/constants'
import type { RoadmapAction } from '@/shared/types/roadmap-automation'
import {
  AlertBanner,
  EmptyStateAction,
  KpiCard,
  PageHeader,
  QuickActionBar,
  SectionCard,
  StatBadge,
} from '@/components/ui/enterprise'
import { HardHat, Banknote, Crown, TrendingUp, ArrowRight, Wrench, Flame, CheckCircle2 } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface DashboardContentProps {
  obras: Obra[]
  leads: Lead[]
  transacoes: Transacao[]
  visitas: Visita[]
  orcamentos: Orcamento[]
  compras: Compra[]
  projetos: Projeto[]
}

interface TodayAlert {
  code: string
  title: string
  severity: 'high' | 'medium' | 'low'
  module: 'obras' | 'leads' | 'financeiro' | 'compras'
  href: string
}

interface TodayAlertsPayload {
  alerts: TodayAlert[]
  totals: {
    high: number
    medium: number
    low: number
    total: number
  }
  warnings: string[]
}

interface RoadmapPayload {
  profileType: string
  progress: {
    total: number
    pending: number
    completedToday: number
  }
  actions: RoadmapAction[]
}

function toneFromSeverity(severity: TodayAlert['severity']) {
  if (severity === 'high') return 'danger' as const
  if (severity === 'medium') return 'warning' as const
  return 'info' as const
}

export function DashboardContent({ obras, leads, transacoes, visitas, compras }: DashboardContentProps) {
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Dashboard
  const [todayAlerts, setTodayAlerts] = useState<TodayAlertsPayload | null>(null)
  const [roadmap, setRoadmap] = useState<RoadmapPayload | null>(null)
  const [completingActionId, setCompletingActionId] = useState<string | null>(null)

  const obrasAtivas = obras.filter((o) => o.status === 'Em Andamento').length
  const receitas = transacoes.filter((t) => t.tipo === 'Receita').reduce((s, t) => s + (t.valor || 0), 0)
  const despesas = transacoes.filter((t) => t.tipo === 'Despesa').reduce((s, t) => s + (t.valor || 0), 0)
  const saldo = receitas - despesas
  const leadsAtivos = leads.filter((l) => l.status !== 'Perdido').length

  const hotLeads = leads.filter((l) => l.temperatura === 'Hot').slice(0, 3)
  const topObras = obras.slice(0, 3)
  const proximasVisitas = visitas.filter((v) => v.status === 'Agendado').slice(0, 5)
  const showOnboarding = obras.length === 0 || leads.length === 0

  useEffect(() => {
    async function loadAlerts() {
      try {
        const payload = await apiRequest<TodayAlertsPayload>('/api/v1/alerts/today')
        setTodayAlerts(payload)
      } catch {
        setTodayAlerts(null)
      }
    }

    loadAlerts()
  }, [])

  useEffect(() => {
    async function loadRoadmap() {
      if (!featureFlags.personalRoadmap) {
        setRoadmap(null)
        return
      }
      try {
        const payload = await apiRequest<RoadmapPayload>('/api/v1/roadmap/me')
        setRoadmap(payload)
      } catch {
        setRoadmap(null)
      }
    }

    loadRoadmap()
  }, [])

  async function completeRoadmapAction(actionId: string) {
    if (!featureFlags.personalRoadmap) return
    setCompletingActionId(actionId)
    try {
      await apiRequest(`/api/v1/roadmap/actions/${actionId}/complete`, {
        method: 'POST',
        body: { status: 'completed' },
      })
      const payload = await apiRequest<RoadmapPayload>('/api/v1/roadmap/me')
      setRoadmap(payload)
    } catch {
      // no-op for dashboard quick action
    } finally {
      setCompletingActionId(null)
    }
  }

  useEffect(() => {
    if (!showOnboarding || !featureFlags.productAnalytics) return
    void apiRequest('/api/v1/analytics/events', {
      method: 'POST',
      body: {
        eventType: 'OnboardingStepCompleted',
        entityType: 'dashboard',
        entityId: 'onboarding-card-visible',
        payload: { obrasCount: obras.length, leadsCount: leads.length },
      },
    }).catch(() => undefined)
  }, [showOnboarding, obras.length, leads.length])

  const financeData = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string; rec: number; dep: number }[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'short' })
      months.push({ key, label, rec: 0, dep: 0 })
    }

    for (const t of transacoes) {
      const key = t.data.slice(0, 7)
      const month = months.find((m) => m.key === key)
      if (!month) continue
      if (t.tipo === 'Receita') month.rec += t.valor
      else month.dep += t.valor
    }

    return {
      labels: months.map((m) => m.label),
      datasets: [
        {
          label: 'Receitas',
          data: months.map((m) => m.rec / 1000),
          borderRadius: 8,
          backgroundColor: 'rgba(16,185,129,0.65)',
        },
        {
          label: 'Despesas',
          data: months.map((m) => m.dep / 1000),
          borderRadius: 8,
          backgroundColor: 'rgba(239,68,68,0.55)',
        },
      ],
    }
  }, [transacoes])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const financeOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label: string }; parsed: { y: number } }) => `${ctx.dataset.label}: R$ ${ctx.parsed.y.toFixed(1)}k`,
        },
      },
    },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v: number | string) => `R$${v}k` }, grid: { color: 'rgba(148,163,184,0.2)' } },
      x: { grid: { display: false } },
    },
  }

  const pipelineSummary = useMemo(() => {
    return KANBAN_COLUMNS.filter((c) => c.id !== 'Perdido').map((col) => {
      const count = leads.filter((lead) => lead.status === col.id).length
      const total = leads
        .filter((lead) => lead.status === col.id)
        .reduce((acc, lead) => acc + (lead.valor_potencial || 0), 0)
      return { id: col.id, label: col.label.replace(' ✓', ''), count, total, dot: col.dot }
    })
  }, [leads])

  const compraPendenteCount = compras.filter((compra) =>
    compra.status === 'Pendente Aprovação Cliente' || compra.status === 'Revisão Cliente'
  ).length

  return (
    <div className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} space-y-5`}>
      <PageHeader
        title="Visão Geral da Operação"
        statusLabel="Sistema Online"
        actions={
          <QuickActionBar
            actions={[
              { label: 'Novo Lead', href: '/leads', tone: 'warning' },
              { label: 'Nova Obra', href: '/obras', tone: 'info' },
            ]}
          />
        }
      />

      {todayAlerts?.alerts?.[0] ? (
        <AlertBanner
          title={todayAlerts.alerts[0].title}
          description={`Módulo: ${todayAlerts.alerts[0].module.toUpperCase()} · ${todayAlerts.totals.total} alertas ativos`}
          tone={toneFromSeverity(todayAlerts.alerts[0].severity)}
          action={
            <Link href={todayAlerts.alerts[0].href} className="rounded-xl bg-sand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sand-600">
              Resolver
            </Link>
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<HardHat className="h-5 w-5 text-sand-700 dark:text-sand-300" />}
          label="Obras Ativas"
          value={String(obrasAtivas)}
          trend={obrasAtivas > 0 ? `+${obrasAtivas}` : undefined}
          progress={Math.min(obrasAtivas * 10, 100)}
          accent="sand"
        />
        <KpiCard
          icon={<Banknote className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />}
          label="Receita 2026"
          value={fmt(receitas)}
          trend="↗ 23%"
          progress={70}
          accent="emerald"
        />
        <KpiCard
          icon={<Crown className="h-5 w-5 text-ocean-700 dark:text-ocean-300" />}
          label="Leads Qualificados"
          value={String(leadsAtivos)}
          trend={`${pipelineSummary.find((p) => p.id === 'Qualificado')?.count || 0} novos`}
          progress={50}
          accent="ocean"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5 text-violet-700 dark:text-violet-300" />}
          label="Meta Q4 2026"
          value={fmt(saldo)}
          trend="85%"
          progress={85}
          accent="violet"
        />
      </div>

      {showOnboarding ? (
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyStateAction
            title="Primeira obra"
            description="Crie sua primeira obra para destravar cronograma, checklist e diário operacional."
            actionLabel="Criar Obra"
            actionHref="/obras"
          />
          <EmptyStateAction
            title="Primeiro lead"
            description="Cadastre um lead para ativar SLA comercial e próxima melhor ação."
            actionLabel="Criar Lead"
            actionHref="/leads"
          />
        </div>
      ) : null}

      {featureFlags.personalRoadmap && roadmap ? (
        <SectionCard
          title="Seu Plano de Hoje"
          subtitle={`Perfil: ${roadmap.profileType} · ${roadmap.progress.pending} pendente(s)`}
          className="p-5"
          right={(
            <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {roadmap.progress.completedToday} concluída(s) hoje
            </span>
          )}
        >
          {roadmap.actions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sem ações pendentes no momento.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {roadmap.actions.slice(0, 3).map((action) => (
                <div
                  key={action.id}
                  className="rounded-xl border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{action.title}</p>
                    <StatBadge
                      label={action.priority}
                      tone={
                        action.priority === 'high'
                          ? 'danger'
                          : action.priority === 'medium'
                            ? 'warning'
                            : 'info'
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{action.whyItMatters}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Link
                      href={action.href}
                      className="text-xs font-semibold text-sand-600 hover:text-sand-700 dark:text-sand-400"
                    >
                      Abrir ação
                    </Link>
                    <button
                      type="button"
                      onClick={() => completeRoadmapAction(action.id)}
                      disabled={completingActionId === action.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 dark:bg-emerald-900/20 dark:text-emerald-300"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {completingActionId === action.id ? '...' : 'Concluir'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard
          title="Obras em Destaque"
          subtitle="Projetos de alto padrão em andamento"
          className="xl:col-span-2 p-5"
          right={
            <Link href="/obras" className="text-sm font-semibold text-sand-600 hover:text-sand-700 dark:text-sand-400 dark:hover:text-sand-300">
              Ver todas <ArrowRight className="inline h-4 w-4" />
            </Link>
          }
        >
          {topObras.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sem obras em andamento.</p>
          ) : (
            <div className="space-y-3">
              {topObras.map((obra) => (
                <Link
                  key={obra.id}
                  href={`/obras/${obra.id}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-sand-300 hover:bg-sand-50/40 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-sand-800 dark:hover:bg-sand-900/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 text-sand-700 dark:bg-sand-900/30 dark:text-sand-300">
                        <Wrench className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xl font-semibold leading-tight text-gray-900 dark:text-gray-100">{obra.nome}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{obra.cliente} • {obra.local}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <StatBadge label={obra.etapa_atual || 'Planejamento'} tone="success" />
                          <StatBadge label={obra.status} tone={obra.status === 'Pausada' ? 'warning' : 'info'} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{fmt(obra.valor_contrato)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Contrato</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Progresso</span>
                      <span className="font-semibold text-sand-700 dark:text-sand-300">{obra.progresso || 0}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800">
                      <div className="h-2 rounded-full bg-gradient-to-r from-sand-500 to-ocean-500" style={{ width: `${obra.progresso || 0}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Pipeline Q4 2026" subtitle="Etapas comerciais" className="p-5">
          <div className="space-y-2.5">
            {pipelineSummary.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.dot }} />
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.label}</p>
                  </div>
                  <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{item.count}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{fmt(item.total)}</p>
              </div>
            ))}
            {compraPendenteCount > 0 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{compraPendenteCount} aprovações pendentes</p>
                <Link href="/compras" className="text-xs text-amber-700 underline dark:text-amber-300">Ir para compras</Link>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard title="Fluxo Financeiro (6 meses)" className="xl:col-span-2 p-5">
          <div className="h-[260px]">
            <Bar data={financeData} options={financeOptions} />
          </div>
        </SectionCard>

        <SectionCard title="Agenda e Leads Quentes" className="p-5">
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Próximas visitas</p>
              <div className="space-y-2">
                {proximasVisitas.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sem visitas agendadas.</p>
                ) : (
                  proximasVisitas.map((visita) => (
                    <div key={visita.id} className="rounded-xl border border-gray-200 p-2.5 dark:border-gray-800">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{visita.titulo}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{fmtDateTime(visita.data_hora)}</p>
                        </div>
                        <StatBadge label={visita.tipo} tone={TIPO_VISITA_COLORS[visita.tipo]?.includes('blue') ? 'info' : 'neutral'} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Hot leads</p>
              <div className="space-y-2">
                {hotLeads.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum lead hot no momento.</p>
                ) : (
                  hotLeads.map((lead) => (
                    <Link key={lead.id} href="/leads" className="flex items-center justify-between rounded-xl border border-gray-200 p-2.5 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
                      <div className="flex items-center gap-2">
                        <Image
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(lead.nome)}&background=d4a373&color=fff`}
                          alt={lead.nome}
                          width={30}
                          height={30}
                          className="h-[30px] w-[30px] rounded-full"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{lead.nome}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{lead.origem}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Flame className="ml-auto h-4 w-4 text-rose-500" />
                        <p className="text-xs font-semibold text-sand-600 dark:text-sand-400">{fmt(lead.valor_potencial || 0)}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {featureFlags.executionAlerts && todayAlerts?.alerts?.length ? (
        <SectionCard title="Prioridades de Hoje" className="p-5" right={<Link href="/obras" className="text-xs text-sand-600 dark:text-sand-400">abrir execução</Link>}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {todayAlerts.alerts.slice(0, 4).map((alert) => (
              <Link key={`${alert.code}-${alert.href}`} href={alert.href} className="rounded-xl border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{alert.title}</p>
                <div className="mt-2 flex items-center justify-between">
                  <StatBadge label={alert.module} tone="neutral" />
                  <StatBadge label={alert.severity.toUpperCase()} tone={toneFromSeverity(alert.severity)} />
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {featureFlags.behaviorPrompts && roadmap?.actions?.length ? (
        <SectionCard title="Faça Agora" subtitle="Ações sugeridas para acelerar resultado" className="p-5">
          <div className="grid gap-2 md:grid-cols-3">
            {roadmap.actions.slice(0, 3).map((action) => (
              <Link
                key={`prompt-${action.id}`}
                href={action.href}
                className="rounded-xl border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{action.title}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tempo estimado: {action.estimatedMinutes} min</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Por que importa: {action.whyItMatters}</p>
              </Link>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}
