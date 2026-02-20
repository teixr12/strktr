'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { logDiario } from '@/lib/diario'
import { Plus, Trash2, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react'
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
    toast('Checklist excluido', 'info')
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

            return (
              <div key={cl.id} className="glass-card rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(expanded ? null : cl.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${TIPO_COLORS[cl.tipo]}`}>
                    {TIPO_LABELS[cl.tipo]}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 text-left">{cl.nome}</span>
                  <span className="text-xs text-gray-500">{done}/{total}</span>
                  {total > 0 && (
                    <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
                    </div>
                  )}
                </button>

                {expanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-200/50 dark:border-gray-800">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 py-1.5 group">
                        <button onClick={() => toggleItem(item.id, item.concluido)} className="flex-shrink-0">
                          {item.concluido ? (
                            <CheckSquare className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <span className={`text-sm flex-1 ${item.concluido ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {item.descricao}
                        </span>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

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
