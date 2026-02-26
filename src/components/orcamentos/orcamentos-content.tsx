'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { apiRequest } from '@/lib/api/client'
import { toast } from '@/hooks/use-toast'
import { fmt, fmtDate } from '@/lib/utils'
import { ORC_STATUS_COLORS } from '@/lib/constants'
import { Plus, X, Trash2, Edit2, Printer, FileText, Search } from 'lucide-react'
import { AiBudgetButton } from './ai-budget-button'
import type { Orcamento, OrcamentoStatus, Lead, Obra } from '@/types/database'

interface Props { initialOrcamentos: Orcamento[] }

interface ItemForm { descricao: string; unidade: string; quantidade: string; valor_unitario: string }

export function OrcamentosContent({ initialOrcamentos }: Props) {
  const supabase = createClient()
  const [orcamentos, setOrcamentos] = useState(initialOrcamentos)
  const [showForm, setShowForm] = useState(false)
  const [editOrc, setEditOrc] = useState<Orcamento | null>(null)
  const [viewOrc, setViewOrc] = useState<Orcamento | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('Todos')
  const [leads, setLeads] = useState<Pick<Lead, 'id' | 'nome'>[]>([])
  const [obras, setObras] = useState<Pick<Obra, 'id' | 'nome'>[]>([])

  const [form, setForm] = useState({
    titulo: '', lead_id: '', obra_id: '', validade: '',
    observacoes: '', status: 'Rascunho' as OrcamentoStatus,
  })
  const [items, setItems] = useState<ItemForm[]>([{ descricao: '', unidade: 'm²', quantidade: '1', valor_unitario: '0' }])

  useEffect(() => {
    async function loadRelated() {
      const [l, o] = await Promise.all([
        supabase.from('leads').select('id, nome').order('nome'),
        supabase.from('obras').select('id, nome').order('nome'),
      ])
      if (l.data) setLeads(l.data)
      if (o.data) setObras(o.data)
    }
    loadRelated()
  }, [supabase])

  const total = orcamentos.length
  const aprovados = orcamentos.filter((o) => o.status === 'Aprovado')
  const aprovadoValor = aprovados.reduce((s, o) => s + o.valor_total, 0)
  const taxaAprovacao = total > 0 ? Math.round((aprovados.length / total) * 100) : 0

  const filtered = useMemo(() => {
    return orcamentos.filter((o) => {
      if (filtroStatus !== 'Todos' && o.status !== filtroStatus) return false
      if (busca && !o.titulo.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
  }, [orcamentos, filtroStatus, busca])

  function resetForm() {
    setForm({ titulo: '', lead_id: '', obra_id: '', validade: '', observacoes: '', status: 'Rascunho' })
    setItems([{ descricao: '', unidade: 'm²', quantidade: '1', valor_unitario: '0' }])
  }

  function openNew() { resetForm(); setEditOrc(null); setShowForm(true) }

  function openEdit(o: Orcamento) {
    setForm({
      titulo: o.titulo, lead_id: o.lead_id || '', obra_id: o.obra_id || '',
      validade: o.validade || '', observacoes: o.observacoes || '', status: o.status,
    })
    setItems(
      o.orcamento_itens && o.orcamento_itens.length > 0
        ? o.orcamento_itens.map((i) => ({
            descricao: i.descricao, unidade: i.unidade, quantidade: String(i.quantidade), valor_unitario: String(i.valor_unitario),
          }))
        : [{ descricao: '', unidade: 'm²', quantidade: '1', valor_unitario: '0' }]
    )
    setEditOrc(o)
    setViewOrc(null)
    setShowForm(true)
  }

  function addItem() { setItems((prev) => [...prev, { descricao: '', unidade: 'm²', quantidade: '1', valor_unitario: '0' }]) }
  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)) }
  function updateItem(idx: number, field: keyof ItemForm, val: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  function calcTotal() {
    return items.reduce((s, it) => s + (parseFloat(it.quantidade) || 0) * (parseFloat(it.valor_unitario) || 0), 0)
  }

  async function saveOrcamento() {
    if (!form.titulo.trim()) { toast('Título é obrigatório', 'error'); return }
    if (items.length === 0 || !items[0].descricao.trim()) { toast('Adicione pelo menos um item', 'error'); return }
    const normalizedItems = items
      .filter((i) => i.descricao.trim())
      .map((i, idx) => ({
        descricao: i.descricao.trim(),
        unidade: i.unidade,
        quantidade: parseFloat(i.quantidade) || 1,
        valor_unitario: parseFloat(i.valor_unitario) || 0,
        ordem: idx,
      }))
    const valor_total = calcTotal()

    const payload = {
      titulo: form.titulo.trim(), status: form.status, valor_total,
      lead_id: form.lead_id || null, obra_id: form.obra_id || null,
      validade: form.validade || null, observacoes: form.observacoes || null,
      items: normalizedItems,
    }

    try {
      if (editOrc) {
        const data = await apiRequest<Orcamento>(`/api/v1/orcamentos/${editOrc.id}`, {
          method: 'PUT',
          body: payload,
        })
        setOrcamentos((prev) => prev.map((o) => o.id === editOrc.id ? data : o))
        toast('Orçamento atualizado!', 'success')
      } else {
        const data = await apiRequest<Orcamento>('/api/v1/orcamentos', {
          method: 'POST',
          body: payload,
        })
        setOrcamentos((prev) => [data, ...prev])
        toast('Orçamento criado!', 'success')
      }
      setShowForm(false)
      setEditOrc(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar orçamento', 'error')
    }
  }

  async function deleteOrcamento(id: string) {
    if (!confirm('Excluir este orçamento?')) return
    try {
      await apiRequest<{ success: boolean }>(`/api/v1/orcamentos/${id}`, { method: 'DELETE' })
      setOrcamentos((prev) => prev.filter((o) => o.id !== id))
      setViewOrc(null)
      toast('Orçamento excluído', 'info')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao excluir orçamento', 'error')
    }
  }

  function printOrcamento(o: Orcamento) {
    const w = window.open('', '_blank')
    if (!w) return
    const itensHtml = (o.orcamento_itens || []).map((i, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#fafaf9' : '#fff'}">
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.descricao}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.unidade}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.quantidade}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">R$ ${(i.valor_unitario).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600">R$ ${(i.quantidade * i.valor_unitario).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
      </tr>`).join('')

    w.document.write(`<!DOCTYPE html><html><head><title>Orçamento - ${o.titulo}</title>
      <style>body{font-family:Inter,system-ui,sans-serif;margin:0;padding:40px;color:#1a1a1a}
      @media print{.no-print{display:none}}</style></head><body>
      <div style="display:flex;align-items:center;justify-content:between;margin-bottom:24px">
        <div><h1 style="margin:0;font-size:24px;color:#d4a373">STRKTR</h1><p style="margin:4px 0 0;font-size:12px;color:#888">Gestão de Obras Premium</p></div>
      </div>
      <h2 style="margin:0 0 8px">${o.titulo}</h2>
      <p style="color:#666;font-size:14px">Status: ${o.status}${o.validade ? ` · Válido até: ${new Date(o.validade).toLocaleDateString('pt-BR')}` : ''}</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0">
        <thead><tr style="background:#d4a373;color:#fff">
          <th style="padding:10px 12px;text-align:left">Descrição</th>
          <th style="padding:10px 12px;text-align:center">Un.</th>
          <th style="padding:10px 12px;text-align:center">Qtd.</th>
          <th style="padding:10px 12px;text-align:right">Valor Un.</th>
          <th style="padding:10px 12px;text-align:right">Total</th>
        </tr></thead><tbody>${itensHtml}</tbody>
      </table>
      <div style="text-align:right;font-size:20px;font-weight:700;color:#d4a373;margin:16px 0">
        Total: R$ ${o.valor_total.toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </div>
      ${o.observacoes ? `<div style="margin-top:24px;padding:16px;background:#fafaf9;border-radius:8px"><p style="font-size:12px;color:#888;margin:0 0 8px">Observações</p><p style="margin:0;font-size:14px;white-space:pre-line">${o.observacoes}</p></div>` : ''}
      <div style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center">
        STRKTR · CNPJ: 53.903.617/0001-83
      </div>
      <button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:12px 24px;background:#d4a373;color:#fff;border:none;border-radius:12px;cursor:pointer;font-size:14px">Imprimir</button>
      </body></html>`)
    w.document.close()
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Orçamentos</h2>
          <p className="text-xs text-gray-500">{total} orçamentos</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-sand-500 hover:bg-sand-600 text-white text-sm font-medium rounded-full transition-all btn-press">
          <Plus className="w-4 h-4" /> Novo Orçamento
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{total}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="text-lg font-semibold text-emerald-600">{fmt(aprovadoValor)}</p>
          <p className="text-xs text-gray-500">Aprovados</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="text-lg font-semibold text-sand-600 dark:text-sand-400">{taxaAprovacao}%</p>
          <p className="text-xs text-gray-500">Taxa Aprovação</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
        </div>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
          <option value="Todos">Todos</option>
          <option value="Rascunho">Rascunho</option>
          <option value="Enviado">Enviado</option>
          <option value="Aprovado">Aprovado</option>
          <option value="Recusado">Recusado</option>
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><FileText className="w-7 h-7 text-gray-400" /></div>
          <p className="text-sm text-gray-500">Nenhum orçamento encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => (
            <div key={o.id} onClick={() => setViewOrc(o)} className="glass-card rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all group">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{o.titulo}</h4>
                  <p className="text-xs text-gray-500">{fmtDate(o.created_at)} · {o.orcamento_itens?.length || 0} itens</p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${ORC_STATUS_COLORS[o.status] || ORC_STATUS_COLORS.Rascunho}`}>{o.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sand-600 dark:text-sand-400">{fmt(o.valor_total)}</span>
                {o.validade && <span className="text-xs text-gray-400">Válido até {fmtDate(o.validade)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      {viewOrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setViewOrc(null)}>
          <div className="modal-glass modal-animate w-full max-w-lg rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{viewOrc.titulo}</h3>
                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${ORC_STATUS_COLORS[viewOrc.status]}`}>{viewOrc.status}</span>
              </div>
              <button onClick={() => setViewOrc(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Items table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                    <th className="text-left py-2 pr-2">Descrição</th>
                    <th className="text-center py-2 px-2">Un.</th>
                    <th className="text-center py-2 px-2">Qtd.</th>
                    <th className="text-right py-2 px-2">Val. Un.</th>
                    <th className="text-right py-2 pl-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewOrc.orcamento_itens || []).map((i, idx) => (
                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-2 text-gray-800 dark:text-gray-200">{i.descricao}</td>
                      <td className="py-2 px-2 text-center text-gray-500">{i.unidade}</td>
                      <td className="py-2 px-2 text-center text-gray-500">{i.quantidade}</td>
                      <td className="py-2 px-2 text-right text-gray-500">{fmt(i.valor_unitario)}</td>
                      <td className="py-2 pl-2 text-right font-semibold text-gray-800 dark:text-gray-200">{fmt(i.quantidade * i.valor_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-right text-lg font-bold text-sand-600 dark:text-sand-400 mb-4">
              Total: {fmt(viewOrc.valor_total)}
            </div>

            {viewOrc.observacoes && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Observações</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{viewOrc.observacoes}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => openEdit(viewOrc)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm">
                <Edit2 className="w-4 h-4" /> Editar
              </button>
              <button onClick={() => printOrcamento(viewOrc)} className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl transition-all text-sm">
                <Printer className="w-4 h-4" />
              </button>
              <button onClick={() => deleteOrcamento(viewOrc.id)} className="flex items-center justify-center gap-2 py-2.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 text-red-600 rounded-2xl transition-all text-sm">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full max-w-lg rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editOrc ? 'Editar Orçamento' : 'Novo Orçamento'}</h3>
              <button onClick={() => { setShowForm(false); setEditOrc(null) }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Título *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />

              <div className="grid grid-cols-2 gap-3">
                <select value={form.lead_id} onChange={(e) => setForm((f) => ({ ...f, lead_id: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="">Lead (opcional)</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
                <select value={form.obra_id} onChange={(e) => setForm((f) => ({ ...f, obra_id: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="">Obra (opcional)</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input value={form.validade} onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value }))} type="date" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white" />
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as OrcamentoStatus }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="Rascunho">Rascunho</option>
                  <option value="Enviado">Enviado</option>
                  <option value="Aprovado">Aprovado</option>
                  <option value="Recusado">Recusado</option>
                </select>
              </div>

              <textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} placeholder="Observações" rows={2} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white resize-none" />

              {/* Line Items */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Itens</span>
                  <div className="flex items-center gap-2">
                    <AiBudgetButton onItemsGenerated={(generated) => setItems(generated)} />
                    <button onClick={addItem} className="text-xs text-sand-600 hover:text-sand-700 font-medium">+ Adicionar Item</button>
                  </div>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <input value={item.descricao} onChange={(e) => updateItem(idx, 'descricao', e.target.value)} placeholder="Descrição *" className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none dark:text-white" />
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input value={item.unidade} onChange={(e) => updateItem(idx, 'unidade', e.target.value)} placeholder="Un." className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none dark:text-white" />
                        <input value={item.quantidade} onChange={(e) => updateItem(idx, 'quantidade', e.target.value)} placeholder="Qtd." type="number" step="0.01" className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none dark:text-white" />
                        <input value={item.valor_unitario} onChange={(e) => updateItem(idx, 'valor_unitario', e.target.value)} placeholder="Valor Un." type="number" step="0.01" className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none dark:text-white" />
                      </div>
                      <div className="text-right text-xs font-medium text-gray-500">
                        Subtotal: {fmt((parseFloat(item.quantidade) || 0) * (parseFloat(item.valor_unitario) || 0))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-right font-bold text-sand-600 dark:text-sand-400 mt-3">
                  Total: {fmt(calcTotal())}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowForm(false); setEditOrc(null) }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button onClick={saveOrcamento} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm">
                  {editOrc ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
