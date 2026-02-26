'use client'

import { useState, useMemo } from 'react'
import { apiRequest } from '@/lib/api/client'
import { toast } from '@/hooks/use-toast'
import { fmt, fmtDate } from '@/lib/utils'
import { COMPRA_STATUS_COLORS, COMPRA_URGENCIA_COLORS } from '@/lib/constants'
import { Plus, Search, ShoppingCart, X } from 'lucide-react'
import type { Compra, CompraStatus, CompraUrgencia } from '@/types/database'

const STATUS_OPTIONS: CompraStatus[] = ['Solicitado', 'Aprovado', 'Pedido', 'Entregue', 'Cancelado']
const URGENCIA_OPTIONS: CompraUrgencia[] = ['Baixa', 'Normal', 'Alta', 'Urgente']
const CATEGORIA_OPTIONS = ['Material', 'Equipamento', 'Ferramenta', 'Servico', 'EPI', 'Outro']

interface Props {
  initialCompras: Compra[]
  obras: { id: string; nome: string }[]
}

export function ComprasContent({ initialCompras, obras }: Props) {
  const [compras, setCompras] = useState(initialCompras)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Compra | null>(null)
  const [form, setForm] = useState({
    descricao: '', categoria: 'Material', fornecedor: '', obra_id: '',
    valor_estimado: '', valor_real: '', status: 'Solicitado' as CompraStatus,
    urgencia: 'Normal' as CompraUrgencia, notas: '',
  })

  const filtered = useMemo(() => {
    let list = compras
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.descricao.toLowerCase().includes(q) || c.fornecedor?.toLowerCase().includes(q) || c.categoria.toLowerCase().includes(q))
    }
    return list
  }, [compras, search, statusFilter])

  async function refresh() {
    try {
      const data = await apiRequest<Compra[]>('/api/v1/compras?limit=200')
      setCompras(data)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao recarregar compras', 'error')
    }
  }

  function openForm(c?: Compra) {
    if (c) {
      setEditing(c)
      setForm({
        descricao: c.descricao, categoria: c.categoria, fornecedor: c.fornecedor || '',
        obra_id: c.obra_id || '', valor_estimado: String(c.valor_estimado || ''),
        valor_real: String(c.valor_real || ''), status: c.status,
        urgencia: c.urgencia, notas: c.notas || '',
      })
    } else {
      setEditing(null)
      setForm({ descricao: '', categoria: 'Material', fornecedor: '', obra_id: '', valor_estimado: '', valor_real: '', status: 'Solicitado', urgencia: 'Normal', notas: '' })
    }
    setShowForm(true)
  }

  async function save() {
    if (!form.descricao.trim()) { toast('Descricao e obrigatoria', 'error'); return }
    const payload = {
      descricao: form.descricao.trim(), categoria: form.categoria,
      fornecedor: form.fornecedor || null, obra_id: form.obra_id || null,
      valor_estimado: parseFloat(form.valor_estimado) || 0,
      valor_real: form.valor_real ? parseFloat(form.valor_real) : null,
      status: form.status, urgencia: form.urgencia,
      notas: form.notas || null,
    }

    try {
      if (editing) {
        await apiRequest<Compra>(`/api/v1/compras/${editing.id}`, { method: 'PUT', body: payload })
        toast('Compra atualizada!', 'success')
      } else {
        await apiRequest<Compra>('/api/v1/compras', { method: 'POST', body: payload })
        toast('Compra registrada!', 'success')
      }
      setShowForm(false)
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar compra', 'error')
    }
  }

  async function updateStatus(id: string, status: CompraStatus) {
    try {
      await apiRequest<Compra>(`/api/v1/compras/${id}`, { method: 'PUT', body: { status } })
      toast('Status atualizado!', 'success')
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao atualizar status', 'error')
    }
  }

  async function deleteCompra(id: string) {
    if (!confirm('Excluir esta compra?')) return
    try {
      await apiRequest<{ success: boolean }>(`/api/v1/compras/${id}`, { method: 'DELETE' })
      toast('Compra excluida', 'info')
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao excluir compra', 'error')
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar compras..." className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
        </div>
        <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2.5 bg-sand-500 hover:bg-sand-600 text-white text-sm font-medium rounded-xl btn-press transition-all">
          <Plus className="w-4 h-4" /> Nova Compra
        </button>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${statusFilter === 'all' ? 'bg-sand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
          Todas ({compras.length})
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${statusFilter === s ? 'bg-sand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {s} ({compras.filter((c) => c.status === s).length})
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nenhuma compra encontrada</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((c) => (
            <div key={c.id} className="glass-card rounded-2xl p-4 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openForm(c)}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{c.descricao}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${COMPRA_STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${COMPRA_URGENCIA_COLORS[c.urgencia] || 'bg-gray-100 text-gray-600'}`}>
                      {c.urgencia}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {c.categoria} · {c.fornecedor || 'Sem fornecedor'} · {c.obras?.nome || 'Sem obra'}
                  </p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                    <span>Est: {fmt(c.valor_estimado)}</span>
                    {c.valor_real !== null && <span>Real: {fmt(c.valor_real)}</span>}
                    <span>{fmtDate(c.data_solicitacao)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <select
                    value={c.status}
                    onChange={(e) => updateStatus(c.id, e.target.value as CompraStatus)}
                    className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => deleteCompra(c.id)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full max-w-lg rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editing ? 'Editar Compra' : 'Nova Compra'}
            </h3>
            <div className="space-y-3">
              <input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descricao da compra *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  {CATEGORIA_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input value={form.fornecedor} onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))} placeholder="Fornecedor" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
              </div>
              {obras.length > 0 && (
                <select value={form.obra_id} onChange={(e) => setForm((f) => ({ ...f, obra_id: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="">Vincular a obra (opcional)</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              )}
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.valor_estimado} onChange={(e) => setForm((f) => ({ ...f, valor_estimado: e.target.value }))} placeholder="Valor estimado (R$)" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
                <input type="number" value={form.valor_real} onChange={(e) => setForm((f) => ({ ...f, valor_real: e.target.value }))} placeholder="Valor real (R$)" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CompraStatus }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={form.urgencia} onChange={(e) => setForm((f) => ({ ...f, urgencia: e.target.value as CompraUrgencia }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  {URGENCIA_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Notas" rows={2} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button onClick={save} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all">{editing ? 'Salvar' : 'Registrar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
