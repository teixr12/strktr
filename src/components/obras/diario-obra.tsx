'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Clock, ArrowUpDown, AlertCircle, CheckSquare, DollarSign, FileText, Camera, ShoppingCart } from 'lucide-react'
import { ago } from '@/lib/utils'
import type { DiarioObra as DiarioEntry } from '@/types/database'

const TIPO_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  status_change: { icon: ArrowUpDown, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', label: 'Status' },
  etapa_change: { icon: CheckSquare, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', label: 'Etapa' },
  transacao: { icon: DollarSign, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Financeiro' },
  checklist: { icon: CheckSquare, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', label: 'Checklist' },
  nota: { icon: FileText, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', label: 'Nota' },
  foto: { icon: Camera, color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400', label: 'Foto' },
  compra: { icon: ShoppingCart, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', label: 'Compra' },
}

interface Props {
  obraId: string
  initialEntries: DiarioEntry[]
}

export function DiarioObraTab({ obraId, initialEntries }: Props) {
  const supabase = createClient()
  const [entries, setEntries] = useState(initialEntries)
  const [noteText, setNoteText] = useState('')
  const [adding, setAdding] = useState(false)

  async function refresh() {
    const { data } = await supabase
      .from('diario_obra')
      .select('*')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false })
    if (data) setEntries(data)
  }

  async function addNote() {
    if (!noteText.trim()) return
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAdding(false); return }
    await supabase.from('diario_obra').insert({
      obra_id: obraId,
      user_id: user.id,
      tipo: 'nota',
      titulo: 'Nota adicionada',
      descricao: noteText.trim(),
    })
    setNoteText('')
    setAdding(false)
    refresh()
  }

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase.channel(`diario-${obraId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diario_obra', filter: `obra_id=eq.${obraId}` }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [obraId, supabase])

  return (
    <div>
      {/* Add note */}
      <div className="flex gap-2 mb-4">
        <input
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Adicionar nota ao diario..."
          className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white"
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
        />
        <button
          onClick={addNote}
          disabled={adding || !noteText.trim()}
          className="px-4 py-2.5 bg-sand-500 hover:bg-sand-600 text-white text-sm font-medium rounded-xl btn-press transition-all disabled:opacity-50"
        >
          {adding ? '...' : 'Adicionar'}
        </button>
      </div>

      {/* Timeline */}
      {entries.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nenhum registro no diario ainda.</p>
          <p className="text-xs text-gray-400 mt-1">Eventos serao registrados automaticamente.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-3">
            {entries.map((entry) => {
              const config = TIPO_CONFIG[entry.tipo] || TIPO_CONFIG.nota
              const Icon = config.icon
              return (
                <div key={entry.id} className="flex gap-3 relative">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 z-10 ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 glass-card rounded-xl p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.titulo}</p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{ago(entry.created_at)}</span>
                    </div>
                    {entry.descricao && (
                      <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{entry.descricao}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
