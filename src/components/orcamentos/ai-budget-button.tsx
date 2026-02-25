'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface ItemSuggestion {
  descricao: string
  unidade: string
  quantidade: number
  valor_unitario: number
}

interface Props {
  onItemsGenerated: (items: { descricao: string; unidade: string; quantidade: string; valor_unitario: string }[]) => void
}

export function AiBudgetButton({ onItemsGenerated }: Props) {
  const [loading, setLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [tipoProjeto, setTipoProjeto] = useState('Residencial')
  const [areaM2, setAreaM2] = useState('')
  const [local, setLocal] = useState('')

  async function generate() {
    if (!areaM2) { toast('Informe a área em m²', 'error'); return }
    setLoading(true)

    try {
      const res = await fetch('/api/ai/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipoProjeto, areaM2: Number(areaM2), local: local || 'Brasil' }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast(data.error || 'Erro ao gerar orçamento', 'error')
        return
      }

      if (!data.items || data.items.length === 0) {
        toast('Nenhum item gerado. Verifique se a API key do Gemini está configurada.', 'error')
        return
      }

      const formattedItems = data.items.map((item: ItemSuggestion) => ({
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: String(item.quantidade),
        valor_unitario: String(item.valor_unitario),
      }))

      onItemsGenerated(formattedItems)
      setShowConfig(false)
      toast(`${formattedItems.length} itens gerados com IA!`, 'success')
    } catch {
      toast('Erro de conexão com a API', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!showConfig) {
    return (
      <button
        type="button"
        onClick={() => setShowConfig(true)}
        className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all"
      >
        <Sparkles className="w-3.5 h-3.5" /> Gerar com IA
      </button>
    )
  }

  return (
    <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-200 dark:border-purple-800 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">Gerar Orçamento com IA</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select
          value={tipoProjeto}
          onChange={(e) => setTipoProjeto(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs dark:text-white"
        >
          <option>Residencial</option>
          <option>Comercial</option>
          <option>Industrial</option>
          <option>Reforma</option>
          <option>Infraestrutura</option>
        </select>
        <input
          value={areaM2}
          onChange={(e) => setAreaM2(e.target.value)}
          placeholder="Área (m²) *"
          type="number"
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none dark:text-white"
        />
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Local"
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none dark:text-white"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowConfig(false)}
          className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg btn-press transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? 'Gerando...' : 'Gerar'}
        </button>
      </div>
    </div>
  )
}
