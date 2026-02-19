'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { fmt, fmtDate } from '@/lib/utils'
import { KANBAN_COLUMNS, TEMPERATURA_EMOJI, TEMPERATURA_COLORS } from '@/lib/constants'
import { Plus, X, Phone, MessageCircle, Trash2, Edit2, GripVertical } from 'lucide-react'
import type { Lead, LeadStatus, LeadTemperatura } from '@/types/database'

interface Props { initialLeads: Lead[] }

const TIPO_OPTIONS = ['Residencial', 'Comercial', 'Industrial', 'Reforma', 'Outro']

export function LeadsContent({ initialLeads }: Props) {
  const supabase = createClient()
  const [leads, setLeads] = useState(initialLeads)
  const [showForm, setShowForm] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const dragRef = useRef<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const [form, setForm] = useState({
    nome: '', email: '', telefone: '', tipo_projeto: 'Residencial',
    valor_potencial: '', temperatura: 'Morno' as LeadTemperatura,
    origem: 'Indicação', notas: '', status: 'Novo' as LeadStatus,
  })

  function resetForm() {
    setForm({ nome: '', email: '', telefone: '', tipo_projeto: 'Residencial', valor_potencial: '', temperatura: 'Morno', origem: 'Indicação', notas: '', status: 'Novo' })
  }

  function openNew() { resetForm(); setEditLead(null); setShowForm(true) }

  function openEdit(l: Lead) {
    setForm({
      nome: l.nome, email: l.email || '', telefone: l.telefone || '',
      tipo_projeto: l.tipo_projeto || 'Residencial', valor_potencial: l.valor_potencial ? String(l.valor_potencial) : '',
      temperatura: l.temperatura, origem: l.origem, notas: l.notas || '', status: l.status,
    })
    setEditLead(l)
    setDetailLead(null)
    setShowForm(true)
  }

  async function saveLead() {
    if (!form.nome.trim()) { toast('Nome é obrigatório', 'error'); return }
    const payload = {
      nome: form.nome.trim(),
      email: form.email || null,
      telefone: form.telefone || null,
      tipo_projeto: form.tipo_projeto,
      valor_potencial: form.valor_potencial ? parseFloat(form.valor_potencial) : null,
      temperatura: form.temperatura,
      origem: form.origem,
      notas: form.notas || null,
      status: form.status,
    }

    if (editLead) {
      const { error } = await supabase.from('leads').update(payload).eq('id', editLead.id)
      if (error) { toast(error.message, 'error'); return }
      setLeads((prev) => prev.map((l) => l.id === editLead.id ? { ...l, ...payload } as Lead : l))
      toast('Lead atualizado!', 'success')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('leads').insert({ ...payload, user_id: user.id }).select().single()
      if (error) { toast(error.message, 'error'); return }
      setLeads((prev) => [data, ...prev])
      toast('Lead criado!', 'success')
    }
    setShowForm(false)
    setEditLead(null)
  }

  async function deleteLead(id: string) {
    if (!confirm('Excluir este lead?')) return
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    setLeads((prev) => prev.filter((l) => l.id !== id))
    setDetailLead(null)
    toast('Lead excluído', 'info')
  }

  async function updateStatus(id: string, status: LeadStatus) {
    const { error } = await supabase.from('leads').update({ status }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l))
  }

  function handleDragStart(id: string) { dragRef.current = id }
  function handleDragEnd() { dragRef.current = null; setDragOverCol(null) }
  function handleDragOver(e: React.DragEvent, colId: string) { e.preventDefault(); setDragOverCol(colId) }
  function handleDragLeave() { setDragOverCol(null) }
  function handleDrop(e: React.DragEvent, colId: string) {
    e.preventDefault()
    setDragOverCol(null)
    if (dragRef.current) updateStatus(dragRef.current, colId as LeadStatus)
  }

  function whatsappUrl(phone: string) {
    return `https://wa.me/55${phone.replace(/\D/g, '')}`
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Leads VIP</h2>
          <p className="text-xs text-gray-500">{leads.length} leads no pipeline</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-sand-500 hover:bg-sand-600 text-white text-sm font-medium rounded-full transition-all btn-press">
          <Plus className="w-4 h-4" /> Novo Lead
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory">
        {KANBAN_COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.id)
          const total = colLeads.reduce((s, l) => s + (l.valor_potencial || 0), 0)
          return (
            <div
              key={col.id}
              className={`flex-shrink-0 w-[280px] snap-center rounded-2xl p-3 transition-all ${
                dragOverCol === col.id ? 'ring-2 ring-sand-400 bg-sand-50/50 dark:bg-sand-900/10' : 'bg-gray-50/80 dark:bg-gray-800/30'
              }`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.dot }} />
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{col.label}</span>
                  <span className="text-xs text-gray-400 bg-gray-200/60 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{colLeads.length}</span>
                </div>
                {total > 0 && <span className="text-xs font-medium text-gray-500">{fmt(total)}</span>}
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-[60px]">
                {colLeads.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Nenhum lead</p>
                ) : (
                  colLeads.map((l) => (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={() => handleDragStart(l.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setDetailLead(l)}
                      className="glass-card rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{l.nome}</span>
                        </div>
                        <span className="text-sm flex-shrink-0">{TEMPERATURA_EMOJI[l.temperatura] || '🌤'}</span>
                      </div>
                      {l.tipo_projeto && <p className="text-xs text-gray-500 mb-1">{l.tipo_projeto}</p>}
                      <div className="flex items-center justify-between">
                        {l.valor_potencial ? (
                          <span className="text-xs font-semibold text-sand-600 dark:text-sand-400">{fmt(l.valor_potencial)}</span>
                        ) : <span />}
                        {l.telefone && (
                          <a href={whatsappUrl(l.telefone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 text-emerald-500 hover:text-emerald-600 transition-colors">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail Modal */}
      {detailLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetailLead(null)}>
          <div className="modal-glass modal-animate w-full max-w-md rounded-3xl shadow-2xl dark:bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{detailLead.nome}</h3>
                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${TEMPERATURA_COLORS[detailLead.temperatura]}`}>
                  {TEMPERATURA_EMOJI[detailLead.temperatura]} {detailLead.temperatura}
                </span>
              </div>
              <button onClick={() => setDetailLead(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-2.5 text-sm">
              {detailLead.email && <div><span className="text-gray-500">Email:</span> <span className="text-gray-900 dark:text-white">{detailLead.email}</span></div>}
              {detailLead.telefone && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Telefone:</span>
                  <span className="text-gray-900 dark:text-white">{detailLead.telefone}</span>
                  <a href={whatsappUrl(detailLead.telefone)} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-600"><MessageCircle className="w-4 h-4" /></a>
                </div>
              )}
              {detailLead.empresa && <div><span className="text-gray-500">Empresa:</span> <span className="text-gray-900 dark:text-white">{detailLead.empresa}</span></div>}
              {detailLead.tipo_projeto && <div><span className="text-gray-500">Tipo:</span> <span className="text-gray-900 dark:text-white">{detailLead.tipo_projeto}</span></div>}
              {detailLead.valor_potencial && <div><span className="text-gray-500">Valor:</span> <span className="font-semibold text-sand-600">{fmt(detailLead.valor_potencial)}</span></div>}
              {detailLead.origem && <div><span className="text-gray-500">Origem:</span> <span className="text-gray-900 dark:text-white">{detailLead.origem}</span></div>}
              {detailLead.notas && <div><span className="text-gray-500">Notas:</span><p className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-line">{detailLead.notas}</p></div>}
              <div><span className="text-gray-500">Criado:</span> <span className="text-gray-900 dark:text-white">{fmtDate(detailLead.created_at)}</span></div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => openEdit(detailLead)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm">
                <Edit2 className="w-4 h-4" /> Editar
              </button>
              <button onClick={() => deleteLead(detailLead.id)} className="flex items-center justify-center gap-2 py-2.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 text-red-600 font-medium rounded-2xl transition-all text-sm">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full max-w-md rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editLead ? 'Editar Lead' : 'Novo Lead'}</h3>
              <button onClick={() => { setShowForm(false); setEditLead(null) }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              <input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="Telefone" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />

              <div className="grid grid-cols-2 gap-3">
                <select value={form.tipo_projeto} onChange={(e) => setForm((f) => ({ ...f, tipo_projeto: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  {TIPO_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={form.valor_potencial} onChange={(e) => setForm((f) => ({ ...f, valor_potencial: e.target.value }))} placeholder="Valor (R$)" type="number" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select value={form.temperatura} onChange={(e) => setForm((f) => ({ ...f, temperatura: e.target.value as LeadTemperatura }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="Hot">🔥 Hot</option>
                  <option value="Morno">🌤 Morno</option>
                  <option value="Frio">❄️ Frio</option>
                </select>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LeadStatus }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  {KANBAN_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <input value={form.origem} onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value }))} placeholder="Origem (ex: Indicação, Instagram)" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              <textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Notas" rows={3} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white resize-none" />

              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowForm(false); setEditLead(null) }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button onClick={saveLead} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm">
                  {editLead ? 'Salvar' : 'Criar Lead'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
