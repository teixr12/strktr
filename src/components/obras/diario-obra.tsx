'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiRequest } from '@/lib/api/client'
import { toast } from '@/hooks/use-toast'
import { Clock, ArrowUpDown, CheckSquare, DollarSign, FileText, Camera, ShoppingCart } from 'lucide-react'
import { ago } from '@/lib/utils'
import type { DiarioObra as DiarioEntry } from '@/types/database'
import { createDiarioNoteSchema, type CreateDiarioNoteDTO } from '@/shared/schemas/execution'

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
  onEntryCreated?: () => void
}

export function DiarioObraTab({ obraId, initialEntries, onEntryCreated }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [tipoFilter, setTipoFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateDiarioNoteDTO>({
    resolver: zodResolver(createDiarioNoteSchema),
    defaultValues: {
      titulo: 'Nota adicionada',
      descricao: '',
    },
  })

  const refresh = useCallback(async (opts?: { tipo?: string; from?: string; to?: string }) => {
    const params = new URLSearchParams()
    if (opts?.tipo && opts.tipo !== 'all') params.set('tipo', opts.tipo)
    if (opts?.from) params.set('from', opts.from)
    if (opts?.to) params.set('to', opts.to)
    try {
      const data = await apiRequest<DiarioEntry[]>(`/api/v1/obras/${obraId}/diario?${params.toString()}`)
      setEntries(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar diário'
      toast(message, 'error')
    }
  }, [obraId])

  async function addNote(values: CreateDiarioNoteDTO) {
    try {
      await apiRequest(`/api/v1/obras/${obraId}/diario/notes`, {
        method: 'POST',
        body: values,
      })
      reset({ titulo: 'Nota adicionada', descricao: '' })
      onEntryCreated?.()
      refresh({ tipo: tipoFilter, from: fromDate, to: toDate })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar nota'
      toast(message, 'error')
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh({ tipo: tipoFilter, from: fromDate, to: toDate })
    }, 0)

    return () => clearTimeout(timer)
  }, [fromDate, refresh, tipoFilter, toDate])

  const uniqueUsers = useMemo(() => {
    const ids = new Set(entries.map((entry) => entry.user_id))
    return Array.from(ids)
  }, [entries])

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:outline-none dark:text-white"
        >
          <option value="all">Todos os tipos</option>
          {Object.entries(TIPO_CONFIG).map(([key, value]) => (
            <option key={key} value={key}>{value.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:outline-none dark:text-white"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs focus:outline-none dark:text-white"
        />
        <div className="flex items-center px-3 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl">
          {uniqueUsers.length} usuário(s) com atividade
        </div>
      </div>

      {/* Add note */}
      <form className="flex gap-2 mb-2" onSubmit={handleSubmit(addNote)}>
        <input
          {...register('descricao')}
          placeholder="Adicionar nota ao diario..."
          className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2.5 bg-sand-500 hover:bg-sand-600 text-white text-sm font-medium rounded-xl btn-press transition-all disabled:opacity-50"
        >
          {isSubmitting ? '...' : 'Adicionar'}
        </button>
      </form>
      {errors.descricao && (
        <p className="text-xs text-red-500 mb-3">{errors.descricao.message}</p>
      )}

      {/* Timeline */}
      {entries.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nenhum registro no diario ainda.</p>
          <p className="text-xs text-gray-400 mt-1">Comece adicionando uma nota ou alterando etapa/checklist.</p>
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
