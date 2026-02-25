'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { logDiario } from '@/lib/diario'
import { fmtDate } from '@/lib/utils'
import { Plus, Trash2, CheckSquare, Square, ChevronDown, ChevronRight, Pencil, CalendarDays, X } from 'lucide-react'
import type { ObraChecklist, ChecklistTipo } from '@/types/database'

const TIPO_LABELS: Record<ChecklistTipo, string> = {
  pre_obra: 'Pre-Obra',
  pos_obra: 'Pos-Obra',
  custom: 'Personalizado',
}

const TIPO_COLORS: Record<ChecklistTipo, string> = {
  pre_obra: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pos_obra: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  custom: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

function getDateColor(dateStr: string | null): string {
  if (!dateStr) return ''
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr < today) return 'text-red-500'
  if (dateStr === today) return 'text-amber-500'
  return 'text-gray-400'
}

interface Props {
  obraId: string
  initialChecklists: ObraChecklist[]
}

export function ObraChecklistsTab({ obraId, initialChecklists }: Props) {
  const supabase = createClient()
  const [checklists, setChecklists] = useState(initialChecklists)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', tipo: 'pre_obra' as ChecklistTipo })
  const [newItemText, setNewItemText] = useState('')

  // Inline edit states
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null)
  const [editingChecklistName, setEditingChecklistName] = useState('')
  const [editingDateItemId, setEditingDateItemId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const editNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingItemId && editInputRef.current) editInputRef.current.focus()
  }, [editingItemId])

  useEffect(() => {
    if (editingChecklistId && editNameRef.current) editNameRef.current.focus()
  }, [editingChecklistId])

  async function refresh() {
    const { data } = await supabase
      .from('obra_checklists')
      .select('*, checklist_items(*)')
      .eq('obra_id', obraId)
      .order('ordem')
    if (data) setChecklists(data)
  }

  async function createChecklist() {
    if (!form.nome.trim()) { toast('Preencha o nome', 'error'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('obra_checklists').insert({
      obra_id: obraId,
      user_id: user.id,
      tipo: form.tipo,
      nome: form.nome.trim(),
    })
    if (error) { toast(error.message, 'error'); return }
    await logDiario(supabase, obraId, user.id, 'checklist', `Checklist "${form.nome}" criado`, `Tipo: ${TIPO_LABELS[form.tipo]}`)
    toast('Checklist criado!', 'success')
    setShowForm(false)
    setForm({ nome: '', tipo: 'pre_obra' })
    refresh()
  }

  async function deleteChecklist(id: string, nome: string) {
    if (!confirm(`Excluir checklist "${nome}"?`)) return
    await supabase.from('obra_checklists').delete().eq('id', id)
    toast('Checklist excluído', 'info')
    refresh()
  }

  async function updateChecklistName(clId: string, nome: string) {
    if (!nome.trim()) { setEditingChecklistId(null); return }
    const { error } = await supabase.from('obra_checklists').update({ nome: nome.trim() }).eq('id', clId)
    if (error) { toast(error.message, 'error'); return }
    setEditingChecklistId(null)
    refresh()
  }

  async function addItem(checklistId: string) {
    if (!newItemText.trim()) return
    await supabase.from('checklist_items').insert({
      checklist_id: checklistId,
      descricao: newItemText.trim(),
    })
    setNewItemText('')
    refresh()
  }

  async function toggleItem(itemId: string, concluido: boolean) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('checklist_items').update({
      concluido: !concluido,
      concluido_por: !concluido ? (user?.email || null) : null,
      concluido_em: !concluido ? new Date().toISOString() : null,
    }).eq('id', itemId)
    refresh()
  }

  async function updateItemText(itemId: string, descricao: string) {
    if (!descricao.trim()) { setEditingItemId(null); return }
    const { error } = await supabase.from('checklist_items').update({ descricao: descricao.trim() }).eq('id', itemId)
    if (error) { toast(error.message, 'error'); return }
    setEditingItemId(null)
    refresh()
  }

  async function updateItemDate(itemId: string, data_limite: string | null) {
    const { error } = await supabase.from('checklist_items').update({ data_limite }).eq('id', itemId)
    if (error) { toast(error.message, 'error'); return }
    setEditingDateItemId(null)
    refresh()
  }

  async function deleteItem(itemId: string) {
    await supabase.from('checklist_items').delete().eq('id', itemId)
    refresh()
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-sand-500 hover:bg-sand-600 text-white text-xs font-medium rounded-full transition-all btn-press"
        >
          <Plus className="w-3.5 h-3.5" /> Novo Checklist
        </button>
      </div>

      {checklists.length === 0 ? (
        <div className="text-center py-8">
          <CheckSquare className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nenhum checklist criado.</p>
          <p className="text-xs text-gray-400 mt-1">Crie checklists Pre-Obra ou Pos-Obra.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {checklists.map((cl) => {
            const items = cl.checklist_items || []
            const done = items.filter((i) => i.concluido).length
            const total = items.length
            const expanded = expandedId === cl.id
            const isEditingName = editingChecklistId === cl.id

            return (
              <div key={cl.id} className="glass-card rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <button onClick={() => setExpandedId(expanded ? null : cl.id)} className="flex-shrink-0">
                    {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </button>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${TIPO_COLORS[cl.tipo]}`}>
                    {TIPO_LABELS[cl.tipo]}
                  </span>

                  {isEditingName ? (
                    <input
                      ref={editNameRef}
                      value={editingChecklistName}
                      onChange={(e) => setEditingChecklistName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateChecklistName(cl.id, editingChecklistName)
                        if (e.key === 'Escape') setEditingChecklistId(null)
                      }}
                      onBlur={() => updateChecklistName(cl.id, editingChecklistName)}
                      className="text-sm font-medium text-gray-900 dark:text-white flex-1 bg-white dark:bg-gray-800 border border-sand-300 dark:border-sand-700 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-sand-400"
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingChecklistId(cl.id); setEditingChecklistName(cl.nome) }}
                      className="text-sm font-medium text-gray-900 dark:text-white flex-1 text-left hover:text-sand-600 dark:hover:text-sand-400 transition-colors group/name flex items-center gap-1.5"
                    >
                      {cl.nome}
                      <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                    </button>
                  )}

                  <span className="text-xs text-gray-500 flex-shrink-0">{done}/{total}</span>
                  {total > 0 && (
                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
                    </div>
                  )}
                </div>

                {expanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-200/50 dark:border-gray-800">
                    {items.map((item) => {
                      const isEditing = editingItemId === item.id
                      const isEditingDate = editingDateItemId === item.id
                      const dateColor = getDateColor(item.data_limite)

                      return (
                        <div key={item.id} className="py-1.5 group">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleItem(item.id, item.concluido)} className="flex-shrink-0">
                              {item.concluido ? (
                                <CheckSquare className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                            </button>

                            {isEditing ? (
                              <input
                                ref={editInputRef}
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') updateItemText(item.id, editingText)
                                  if (e.key === 'Escape') setEditingItemId(null)
                                }}
                                onBlur={() => updateItemText(item.id, editingText)}
                                className="text-sm flex-1 bg-white dark:bg-gray-800 border border-sand-300 dark:border-sand-700 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-sand-400 dark:text-white"
                              />
                            ) : (
                              <button
                                onClick={() => { setEditingItemId(item.id); setEditingText(item.descricao) }}
                                className={`text-sm flex-1 text-left transition-colors ${item.concluido ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300 hover:text-sand-600 dark:hover:text-sand-400'}`}
                              >
                                {item.descricao}
                              </button>
                            )}

                            {/* Date picker toggle */}
                            <button
                              onClick={() => setEditingDateItemId(isEditingDate ? null : item.id)}
                              className={`flex-shrink-0 p-1 rounded transition-all ${item.data_limite ? dateColor : 'text-gray-300 opacity-0 group-hover:opacity-100'} hover:text-sand-600`}
                              title={item.data_limite ? `Prazo: ${fmtDate(item.data_limite)}` : 'Definir prazo'}
                            >
                              <CalendarDays className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => deleteItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all flex-shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Date display and editor */}
                          {(item.data_limite || isEditingDate) && (
                            <div className="ml-6 mt-1 flex items-center gap-2">
                              {isEditingDate ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="date"
                                    value={item.data_limite || ''}
                                    onChange={(e) => updateItemDate(item.id, e.target.value || null)}
                                    className="px-2 py-0.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none dark:text-white"
                                  />
                                  {item.data_limite && (
                                    <button
                                      onClick={() => updateItemDate(item.id, null)}
                                      className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                                      title="Remover prazo"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className={`text-[10px] font-medium ${dateColor}`}>
                                  Prazo: {fmtDate(item.data_limite!)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <div className="flex gap-2 mt-2">
                      <input
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder="Adicionar item..."
                        className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none dark:text-white"
                        onKeyDown={(e) => e.key === 'Enter' && addItem(cl.id)}
                      />
                      <button
                        onClick={() => addItem(cl.id)}
                        className="px-3 py-1.5 bg-sand-500 hover:bg-sand-600 text-white text-xs rounded-lg transition-all"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => deleteChecklist(cl.id, cl.nome)}
                      className="mt-2 text-[10px] text-red-400 hover:text-red-600 transition-colors"
                    >
                      Excluir checklist
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New Checklist Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full max-w-sm rounded-3xl shadow-2xl dark:bg-gray-900 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Novo Checklist</h3>
            <div className="space-y-3">
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome do checklist *"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white"
              />
              <select
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as ChecklistTipo }))}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white"
              >
                <option value="pre_obra">Pre-Obra</option>
                <option value="pos_obra">Pos-Obra</option>
                <option value="custom">Personalizado</option>
              </select>
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button onClick={createChecklist} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all">Criar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
