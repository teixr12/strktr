'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Obra, Lead, Transacao, Visita, Orcamento, Compra, Projeto } from '@/types/database'
import { apiRequest } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { fmt, fmtDate, fmtDateTime } from '@/lib/utils'
import { OBRA_STATUS_COLORS, OBRA_ICON_COLORS, TEMPERATURA_COLORS, TIPO_VISITA_COLORS } from '@/lib/constants'
import { KANBAN_COLUMNS } from '@/lib/constants'
import {
  HardHat,
  Banknote,
  Crown,
  TrendingUp,
  ArrowRight,
  Calendar,
  Home,
  Building,
  TreePine,
  Activity,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

const obraIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  building: Building,
  'tree-pine': TreePine,
}

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

export function DashboardContent({ obras, leads, transacoes, visitas }: DashboardContentProps) {
  const [todayAlerts, setTodayAlerts] = useState<TodayAlertsPayload | null>(null)
  const obrasAtivas = obras.filter((o) => o.status === 'Em Andamento').length
  const receitas = transacoes
    .filter((t) => t.tipo === 'Receita')
    .reduce((s, t) => s + (t.valor || 0), 0)
  const despesas = transacoes
    .filter((t) => t.tipo === 'Despesa')
    .reduce((s, t) => s + (t.valor || 0), 0)
  const leadsAtivos = leads.filter((l) => l.status !== 'Perdido').length
  const saldo = receitas - despesas
  const hotLeads = leads.filter((l) => l.temperatura === 'Hot').slice(0, 4)
  const proxVisitas = visitas.filter((v) => v.status === 'Agendado').slice(0, 5)
  const topObras = obras.slice(0, 3)
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

  // Chart: Fluxo Financeiro — últimos 6 meses
  const fluxoData = useMemo(() => {
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
      const m = months.find((x) => x.key === key)
      if (m) { if (t.tipo === 'Receita') m.rec += t.valor; else m.dep += t.valor }
    }
    return {
      labels: months.map((m) => m.label),
      datasets: [
        { label: 'Receitas', data: months.map((m) => m.rec / 1000), backgroundColor: 'rgba(52,211,153,.7)', borderRadius: 6 },
        { label: 'Despesas', data: months.map((m) => m.dep / 1000), backgroundColor: 'rgba(251,113,133,.7)', borderRadius: 6 },
      ],
    }
  }, [transacoes])

  // Chart: Obras por Status
  const obrasStatusData = useMemo(() => {
    const statusMap: Record<string, { count: number; color: string }> = {
      'Em Andamento': { count: 0, color: '#f59e0b' },
      'Concluída': { count: 0, color: '#10b981' },
      'Pausada': { count: 0, color: '#9ca3af' },
      'Cancelada': { count: 0, color: '#ef4444' },
      'Orçamento': { count: 0, color: '#3b82f6' },
    }
    for (const o of obras) { if (statusMap[o.status]) statusMap[o.status].count++ }
    const entries = Object.entries(statusMap).filter(([, v]) => v.count > 0)
    return {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([, v]) => v.count),
        backgroundColor: entries.map(([, v]) => v.color),
        borderWidth: 0,
        hoverOffset: 6,
      }],
    }
  }, [obras])

  // Chart: Pipeline — Valor por Etapa
  const pipelineData = useMemo(() => {
    const cols = KANBAN_COLUMNS.filter((c) => c.id !== 'Perdido')
    const valores = cols.map((col) =>
      leads.filter((l) => l.status === col.id).reduce((s, l) => s + (l.valor_potencial || 0), 0)
    )
    return {
      labels: cols.map((c) => c.label.replace(' ✓', '')),
      datasets: [{
        label: 'Valor (R$k)',
        data: valores.map((v) => v / 1000),
        backgroundColor: cols.map((c) => c.dot),
        borderRadius: 6,
      }],
    }
  }, [leads])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { usePointStyle: true, pointStyleWidth: 8, padding: 12, font: { size: 10 } } },
      tooltip: { callbacks: { label: (ctx: { dataset: { label: string }; parsed: { y: number } }) => `${ctx.dataset.label}: R$${ctx.parsed.y.toFixed(1)}k` } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { callback: (v: number | string) => `R$${v}k`, font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doughnutOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, pointStyleWidth: 8, padding: 12, font: { size: 10 } } },
    },
    cutout: '60%',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const horizontalBarOpts: any = {
    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: { parsed: { x: number } }) => `R$${ctx.parsed.x.toFixed(1)}k` } },
    },
    scales: {
      x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { callback: (v: number | string) => `R$${v}k`, font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard icon={<HardHat className="w-5 h-5 text-sand-600 dark:text-sand-400" />} iconBg="bg-sand-100 dark:bg-sand-900/20" value={String(obrasAtivas)} label="obras ativas" />
        <KpiCard icon={<Banknote className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-100 dark:bg-emerald-900/20" value={fmt(receitas)} label="receita total" />
        <KpiCard icon={<Crown className="w-5 h-5 text-ocean-600" />} iconBg="bg-ocean-100 dark:bg-ocean-900/20" value={String(leadsAtivos)} label="leads ativos" />
        <KpiCard icon={<TrendingUp className="w-5 h-5 text-purple-600" />} iconBg="bg-purple-100 dark:bg-purple-900/20" value={fmt(saldo)} label="saldo líquido" className="col-span-2 lg:col-span-1" />
      </div>

      {showOnboarding && (
        <div className="glass-card rounded-3xl p-4 md:p-5 border border-sand-200/50 dark:border-sand-800/50">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Onboarding Guiado</h3>
          <p className="text-sm text-gray-500 mb-3">Complete os 2 primeiros passos para ativar o CRM operacional.</p>
          <div className="grid gap-2 md:grid-cols-2">
            <Link href="/obras" className="rounded-2xl px-4 py-3 bg-sand-50 dark:bg-sand-900/20 hover:bg-sand-100 dark:hover:bg-sand-900/30 transition-colors">
              <p className="text-sm font-semibold text-sand-700 dark:text-sand-300">1. Criar primeira obra</p>
              <p className="text-xs text-gray-500">Configure etapas, checklist e diário.</p>
            </Link>
            <Link href="/leads" className="rounded-2xl px-4 py-3 bg-ocean-50 dark:bg-ocean-900/20 hover:bg-ocean-100 dark:hover:bg-ocean-900/30 transition-colors">
              <p className="text-sm font-semibold text-ocean-700 dark:text-ocean-300">2. Criar primeiro lead</p>
              <p className="text-xs text-gray-500">Ative next-action e SLA comercial.</p>
            </Link>
          </div>
        </div>
      )}

      {featureFlags.executionAlerts && todayAlerts && todayAlerts.alerts.length > 0 && (
        <div className="glass-card rounded-3xl p-4 md:p-5 border border-amber-200/50 dark:border-amber-800/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Prioridades de Hoje</h3>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {todayAlerts.totals.total} alertas
            </span>
          </div>
          <div className="space-y-2">
            {todayAlerts.alerts.slice(0, 4).map((alert) => (
              <div key={`${alert.code}-${alert.href}`} className="flex items-center justify-between gap-2 rounded-2xl bg-white/60 dark:bg-gray-900/40 p-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{alert.title}</p>
                  <p className="text-xs text-gray-500 capitalize">{alert.module}</p>
                </div>
                <Link
                  href={alert.href}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-full whitespace-nowrap ${
                    alert.severity === 'high'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : alert.severity === 'medium'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}
                >
                  Resolver
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="glass-card rounded-3xl p-4 md:p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Fluxo Financeiro</h3>
          <div className="h-[200px]">
            <Bar data={fluxoData} options={barOpts} />
          </div>
        </div>
        <div className="glass-card rounded-3xl p-4 md:p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Obras por Status</h3>
          <div className="h-[200px]">
            {obrasStatusData.labels.length > 0 ? (
              <Doughnut data={obrasStatusData} options={doughnutOpts} />
            ) : (
              <p className="text-sm text-gray-500 text-center pt-16">Sem dados</p>
            )}
          </div>
        </div>
        <div className="glass-card rounded-3xl p-4 md:p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Pipeline — Valor por Etapa</h3>
          <div className="h-[200px]">
            <Bar data={pipelineData} options={horizontalBarOpts} />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Obras em Destaque */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Obras em Destaque</h3>
              <p className="text-xs text-gray-500">Projetos em andamento</p>
            </div>
            <Link href="/obras" className="text-xs font-medium text-sand-600 dark:text-sand-400 hover:text-sand-700 flex items-center gap-1">
              Ver todas <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {topObras.length === 0 ? (
              <EmptyState msg="Nenhuma obra cadastrada" />
            ) : (
              topObras.map((o) => <ObraCard key={o.id} obra={o} />)
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4 md:space-y-5">
          {/* Hot Leads */}
          <div className="glass-card rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Leads Hot 🔥</h3>
              <Link href="/leads" className="text-xs text-sand-600 dark:text-sand-400">Ver todos</Link>
            </div>
            <div className="space-y-1.5">
              {hotLeads.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum lead hot</p>
              ) : (
                hotLeads.map((l) => <LeadMiniCard key={l.id} lead={l} />)
              )}
            </div>
          </div>

          {/* Próximas Visitas */}
          <div className="glass-card rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Próximas Visitas</h3>
              <Link href="/calendario" className="text-xs text-sand-600 dark:text-sand-400">Ver agenda</Link>
            </div>
            <div className="space-y-2">
              {proxVisitas.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhuma visita agendada</p>
              ) : (
                proxVisitas.map((v) => (
                  <div key={v.id} className="timeline-item relative pl-10 pb-5">
                    <div className="absolute left-0 w-8 h-8 rounded-full bg-sand-100 dark:bg-sand-900/30 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-sand-600 dark:text-sand-400" />
                    </div>
                    <div className="glass-card rounded-xl p-3">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">{v.titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmtDateTime(v.data_hora)} · {v.obras?.nome || v.leads?.nome || v.local || ''}
                      </p>
                      <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${TIPO_VISITA_COLORS[v.tipo] || TIPO_VISITA_COLORS.Outro}`}>
                        {v.tipo}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline + Atividade Recente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Mini Pipeline */}
        <div className="glass-card rounded-3xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Pipeline de Leads</h3>
            <Link href="/leads" className="text-xs text-sand-600 dark:text-sand-400">Ver kanban</Link>
          </div>
          <div className="space-y-2">
            {KANBAN_COLUMNS.filter((c) => c.id !== 'Perdido').map((col) => {
              const count = leads.filter((l) => l.status === col.id).length
              const total = leads.filter((l) => l.status !== 'Perdido').length || 1
              const pct = Math.round((count / total) * 100)
              return (
                <div key={col.id} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.dot }} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-24 truncate">{col.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: col.dot }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="glass-card rounded-3xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Atividade Recente</h3>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <div className="space-y-2">
            {(() => {
              const activities = [
                ...transacoes.slice(0, 5).map((t) => ({
                  id: t.id,
                  icon: t.tipo === 'Receita' ? '💰' : '💸',
                  text: `${t.tipo === 'Receita' ? 'Receita' : 'Despesa'}: ${t.descricao}`,
                  sub: `${fmt(t.valor)} · ${t.categoria}`,
                  date: t.data,
                })),
                ...visitas.filter((v) => v.status === 'Realizado').slice(0, 3).map((v) => ({
                  id: v.id,
                  icon: '📍',
                  text: `Visita: ${v.titulo}`,
                  sub: v.obras?.nome || v.local || '',
                  date: v.data_hora.slice(0, 10),
                })),
                ...leads.slice(0, 3).map((l) => ({
                  id: l.id,
                  icon: '👤',
                  text: `Lead: ${l.nome}`,
                  sub: l.tipo_projeto || l.empresa || '',
                  date: l.created_at.slice(0, 10),
                })),
              ]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 8)

              if (activities.length === 0) {
                return <p className="text-sm text-gray-500 text-center py-4">Sem atividade recente</p>
              }

              return activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-2 rounded-xl hover:bg-white/50 dark:hover:bg-gray-800/50 transition-all">
                  <span className="text-base mt-0.5">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{a.text}</p>
                    <p className="text-xs text-gray-400 truncate">{a.sub}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(a.date)}</span>
                </div>
              ))
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  icon,
  iconBg,
  value,
  label,
  className = '',
}: {
  icon: React.ReactNode
  iconBg: string
  value: string
  label: string
  className?: string
}) {
  return (
    <div className={`glass-card rounded-2xl p-4 md:p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 ${iconBg} rounded-xl`}>{icon}</div>
      </div>
      <p className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-0.5">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function ObraCard({ obra: o }: { obra: Obra }) {
  const Icon = obraIcons[o.icone] || Home
  const iColor = OBRA_ICON_COLORS[o.cor || 'sand'] || OBRA_ICON_COLORS.sand

  return (
    <Link
      href={`/obras/${o.id}`}
      className="group block p-4 md:p-5 rounded-2xl bg-white/50 dark:bg-gray-800/50 border border-transparent hover:border-sand-300 dark:hover:border-sand-700 transition-all cursor-pointer hover:shadow-lg"
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${iColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-5 h-5 text-sand-700 dark:text-sand-300" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm md:text-base text-gray-900 dark:text-white truncate">{o.nome}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{o.cliente} · {o.local}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-semibold text-sm text-gray-900 dark:text-white">{fmt(o.valor_contrato)}</div>
          {o.area_m2 ? <div className="text-xs text-gray-400">{o.area_m2}m²</div> : null}
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${OBRA_STATUS_COLORS[o.status] || OBRA_STATUS_COLORS['Em Andamento']}`}>
          {o.status}
        </span>
        <span className="text-xs text-gray-500">{o.etapa_atual || ''}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Progresso</span>
            <span className="font-semibold text-sand-600 dark:text-sand-400">{o.progresso || 0}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sand-400 to-sand-600 rounded-full progress-fill"
              style={{ width: `${o.progresso || 0}%` }}
            />
          </div>
        </div>
      </div>
      {o.data_previsao && (
        <div className="mt-2 text-xs text-gray-400">Previsão: {fmtDate(o.data_previsao)}</div>
      )}
    </Link>
  )
}

function LeadMiniCard({ lead: l }: { lead: Lead }) {
  return (
    <Link
      href="/leads"
      className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-sand-50 dark:hover:bg-sand-900/20 transition-all"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Image
          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(l.nome)}&background=d4a373&color=fff`}
          alt={l.nome}
          width={32}
          height={32}
          className="w-8 h-8 rounded-full flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{l.nome}</p>
          <p className="text-xs text-gray-500 truncate">{l.tipo_projeto || l.empresa || ''}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${TEMPERATURA_COLORS[l.temperatura] || TEMPERATURA_COLORS.Morno}`}>
          {l.temperatura}
        </span>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {l.valor_potencial ? fmt(l.valor_potencial) : ''}
        </span>
      </div>
    </Link>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <HardHat className="w-7 h-7 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500">{msg}</p>
    </div>
  )
}
