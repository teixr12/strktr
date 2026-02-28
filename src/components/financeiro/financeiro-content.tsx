'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { apiRequest } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { toast } from '@/hooks/use-toast'
import { fmt, fmtDate } from '@/lib/utils'
import { Plus, X, Trash2, TrendingUp, TrendingDown, Wallet, Hash, Pencil } from 'lucide-react'
import type { Transacao, Obra } from '@/types/database'
import { PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'

const LazyBarChart = dynamic(
  () =>
    import('@/components/ui/enterprise/lazy-bar-chart').then(
      (module) => module.LazyBarChart
    ),
  {
    ssr: false,
    loading: () => <div className="skeleton h-[240px] w-full rounded-xl" />,
  }
)

interface Props { initialTransacoes: Transacao[] }
interface OrcadoVsRealizadoSummary {
  summary: Array<{
    obraId: string
    nome: string
    valorOrcado: number
    valorRealizado: number
    desvio: number
    desvioPct: number
    isCritical: boolean
  }>
  totals: {
    totalObras: number
    totalCritical: number
  }
}

export function FinanceiroContent({ initialTransacoes }: Props) {
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Financeiro
  const [transacoes, setTransacoes] = useState(initialTransacoes)
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transacao | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'Todos' | 'Receita' | 'Despesa'>('Todos')
  const [busca, setBusca] = useState('')
  const [obras, setObras] = useState<Pick<Obra, 'id' | 'nome'>[]>([])
  const [desvioResumo, setDesvioResumo] = useState<OrcadoVsRealizadoSummary | null>(null)

  const [form, setForm] = useState({
    descricao: '', tipo: 'Receita' as 'Receita' | 'Despesa',
    categoria: '', valor: '', data: new Date().toISOString().slice(0, 10), obra_id: '',
  })

  useEffect(() => {
    async function loadObras() {
      try {
        const data = await apiRequest<Pick<Obra, 'id' | 'nome'>[]>('/api/v1/obras?limit=200')
        setObras(data)
      } catch {
        setObras([])
      }
    }
    loadObras()
  }, [])

  async function loadDesvio() {
    try {
      const data = await apiRequest<OrcadoVsRealizadoSummary>('/api/v1/transacoes/orcado-vs-realizado?thresholdPct=10')
      setDesvioResumo(data)
    } catch {
      setDesvioResumo(null)
    }
  }

  useEffect(() => {
    let active = true
    void apiRequest<OrcadoVsRealizadoSummary>('/api/v1/transacoes/orcado-vs-realizado?thresholdPct=10')
      .then((data) => {
        if (active) setDesvioResumo(data)
      })
      .catch(() => {
        if (active) setDesvioResumo(null)
      })
    return () => {
      active = false
    }
  }, [])

  const receitas = transacoes.filter((t) => t.tipo === 'Receita').reduce((s, t) => s + t.valor, 0)
  const despesas = transacoes.filter((t) => t.tipo === 'Despesa').reduce((s, t) => s + t.valor, 0)
  const saldo = receitas - despesas

  const filtered = useMemo(() => {
    return transacoes.filter((t) => {
      if (filtroTipo !== 'Todos' && t.tipo !== filtroTipo) return false
      if (busca && !t.descricao.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
  }, [transacoes, filtroTipo, busca])

  // Chart data — last 6 months
  const chartData = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string; rec: number; dep: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      months.push({ key, label, rec: 0, dep: 0 })
    }
    for (const t of transacoes) {
      const key = t.data.slice(0, 7)
      const m = months.find((x) => x.key === key)
      if (m) {
        if (t.tipo === 'Receita') m.rec += t.valor
        else m.dep += t.valor
      }
    }
    return {
      labels: months.map((m) => m.label),
      datasets: [
        { label: 'Receitas', data: months.map((m) => m.rec / 1000), backgroundColor: 'rgba(52,211,153,.7)', borderRadius: 6 },
        { label: 'Despesas', data: months.map((m) => m.dep / 1000), backgroundColor: 'rgba(251,113,133,.7)', borderRadius: 6 },
      ],
    }
  }, [transacoes])

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { usePointStyle: true, pointStyleWidth: 8, padding: 16, font: { size: 11 } } },
      tooltip: { callbacks: { label: (ctx: { dataset: { label: string }; parsed: { y: number } }) => `${ctx.dataset.label}: R$${ctx.parsed.y.toFixed(1)}k` } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { callback: (v: number | string) => `R$${v}k`, font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  }

  function openEditTx(tx: Transacao) {
    setEditingTx(tx)
    setForm({
      descricao: tx.descricao, tipo: tx.tipo, categoria: tx.categoria,
      valor: String(tx.valor), data: tx.data, obra_id: tx.obra_id || '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingTx(null)
    setForm({ descricao: '', tipo: 'Receita', categoria: '', valor: '', data: new Date().toISOString().slice(0, 10), obra_id: '' })
  }

  async function saveTx() {
    if (!form.descricao.trim()) { toast('Descrição é obrigatória', 'error'); return }
    if (!form.valor || parseFloat(form.valor) <= 0) { toast('Valor inválido', 'error'); return }
    if (!form.categoria.trim()) { toast('Categoria é obrigatória', 'error'); return }
    const payload = {
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      categoria: form.categoria.trim(),
      valor: parseFloat(form.valor),
      data: form.data,
      obra_id: form.obra_id || null,
    }

    try {
      if (editingTx) {
        const data = await apiRequest<Transacao>(`/api/v1/transacoes/${editingTx.id}`, { method: 'PUT', body: payload })
        setTransacoes((prev) => prev.map((t) => t.id === editingTx.id ? data : t))
        toast('Transação atualizada!', 'success')
      } else {
        const data = await apiRequest<Transacao>('/api/v1/transacoes', { method: 'POST', body: payload })
        setTransacoes((prev) => [data, ...prev])
        toast('Transação criada!', 'success')
      }
      await loadDesvio()
      closeForm()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar transação', 'error')
    }
  }

  async function deleteTx(id: string) {
    if (!confirm('Excluir esta transação?')) return
    try {
      await apiRequest<{ success: boolean }>(`/api/v1/transacoes/${id}`, { method: 'DELETE' })
      setTransacoes((prev) => prev.filter((t) => t.id !== id))
      await loadDesvio()
      toast('Transação excluída', 'info')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao excluir transação', 'error')
    }
  }

  return (
    <div className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} space-y-5`}>
      <PageHeader
        title="Financeiro"
        subtitle={`${transacoes.length} transações`}
        actions={
          <QuickActionBar
            actions={[{
              label: 'Nova Transação',
              icon: <Plus className="h-4 w-4" />,
              onClick: () => {
                closeForm()
                setShowForm(true)
              },
              tone: 'warning',
            }]}
          />
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg"><TrendingUp className="w-4 h-4 text-emerald-600" /></div></div>
          <p className="text-lg font-semibold text-emerald-600">{fmt(receitas)}</p>
          <p className="text-xs text-gray-500">Total Receitas</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-red-100 dark:bg-red-900/20 rounded-lg"><TrendingDown className="w-4 h-4 text-red-500" /></div></div>
          <p className="text-lg font-semibold text-red-500">{fmt(despesas)}</p>
          <p className="text-xs text-gray-500">Total Despesas</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-sand-100 dark:bg-sand-900/20 rounded-lg"><Wallet className="w-4 h-4 text-sand-600" /></div></div>
          <p className={`text-lg font-semibold ${saldo >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(saldo)}</p>
          <p className="text-xs text-gray-500">Saldo Líquido</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-purple-100 dark:bg-purple-900/20 rounded-lg"><Hash className="w-4 h-4 text-purple-600" /></div></div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{transacoes.length}</p>
          <p className="text-xs text-gray-500">Transações</p>
        </div>
      </div>

      {/* Chart */}
      <SectionCard className="p-4 md:p-5">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Receitas vs Despesas (últimos 6 meses)</h3>
        <div className="h-[240px]">
          <LazyBarChart data={chartData} options={chartOpts as never} />
        </div>
      </SectionCard>

      {desvioResumo && (
        <div className="glass-card rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Desvio Orçado x Realizado</h3>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              desvioResumo.totals.totalCritical > 0
                ? 'bg-red-100 text-red-600'
                : 'bg-emerald-100 text-emerald-600'
            }`}>
              {desvioResumo.totals.totalCritical} críticas
            </span>
          </div>
          {desvioResumo.summary.slice(0, 3).map((obra) => (
            <div key={obra.obraId} className="flex items-center justify-between py-2 border-b last:border-0 border-gray-200/60 dark:border-gray-700/60">
              <div>
                <p className="text-sm text-gray-900 dark:text-white">{obra.nome}</p>
                <p className="text-xs text-gray-500">Orçado {fmt(obra.valorOrcado)} · Realizado {fmt(obra.valorRealizado)}</p>
              </div>
              <span className={`text-sm font-semibold ${obra.isCritical ? 'text-red-500' : 'text-emerald-600'}`}>
                {obra.desvioPct >= 0 ? '+' : ''}{obra.desvioPct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <SectionCard className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descrição..." className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          <div className="flex gap-1">
            {(['Todos', 'Receita', 'Despesa'] as const).map((t) => (
              <button key={t} onClick={() => setFiltroTipo(t)} className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${filtroTipo === t ? 'bg-sand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Transaction List */}
      <SectionCard className="space-y-1.5 p-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Nenhuma transação encontrada</p>
        ) : (
          filtered.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-all group">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.tipo === 'Receita' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  <div className={`w-3 h-3 rounded-full ${t.tipo === 'Receita' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.descricao}</p>
                  <p className="text-xs text-gray-400">{fmtDate(t.data)} · {t.categoria}{t.obras?.nome ? ` · ${t.obras.nome}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm ${t.tipo === 'Receita' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {t.tipo === 'Receita' ? '+' : '-'}{fmt(t.valor)}
                </span>
                <button onClick={() => openEditTx(t)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-sand-600 transition-all">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteTx(t.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </SectionCard>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full max-w-md rounded-3xl shadow-2xl dark:bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editingTx ? 'Editar Transação' : 'Nova Transação'}</h3>
              <button onClick={closeForm} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descrição *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as 'Receita' | 'Despesa' }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="Receita">Receita</option>
                  <option value="Despesa">Despesa</option>
                </select>
                <input value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} placeholder="Categoria *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} placeholder="Valor (R$) *" type="number" step="0.01" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
                <input value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} type="date" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white" />
              </div>
              <select value={form.obra_id} onChange={(e) => setForm((f) => ({ ...f, obra_id: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                <option value="">Obra (opcional)</option>
                {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button onClick={saveTx} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm">{editingTx ? 'Salvar' : 'Criar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
