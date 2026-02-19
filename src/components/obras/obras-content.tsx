'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { fmt, fmtDate } from '@/lib/utils'
import { OBRA_STATUS_COLORS, OBRA_ICON_COLORS } from '@/lib/constants'
import { Plus, HardHat, Home, Building, TreePine } from 'lucide-react'
import { ObraFormModal } from './obra-form-modal'
import type { Obra } from '@/types/database'

const obraIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  building: Building,
  'tree-pine': TreePine,
}

export function ObrasContent({ initialObras }: { initialObras: Obra[] }) {
  const [obras, setObras] = useState(initialObras)
  const [showForm, setShowForm] = useState(false)
  const supabase = createClient()

  async function refresh() {
    const { data } = await supabase.from('obras').select('*').order('created_at', { ascending: false })
    if (data) setObras(data)
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Todas as Obras</h3>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-sand-500 hover:bg-sand-600 text-white text-sm font-medium rounded-full btn-press transition-all shadow-md"
        >
          <Plus className="w-4 h-4" /> Nova Obra
        </button>
      </div>

      {obras.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <HardHat className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">Nenhuma obra cadastrada ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {obras.map((o) => {
            const Icon = obraIcons[o.icone] || Home
            const iColor = OBRA_ICON_COLORS[o.cor || 'sand'] || OBRA_ICON_COLORS.sand
            return (
              <Link
                key={o.id}
                href={`/obras/${o.id}`}
                className="group p-4 md:p-5 rounded-2xl bg-white/50 dark:bg-gray-800/50 border border-transparent hover:border-sand-300 dark:hover:border-sand-700 transition-all cursor-pointer hover:shadow-lg"
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
                      <div className="h-full bg-gradient-to-r from-sand-400 to-sand-600 rounded-full progress-fill" style={{ width: `${o.progresso || 0}%` }} />
                    </div>
                  </div>
                </div>
                {o.data_previsao && <div className="mt-2 text-xs text-gray-400">Previsão: {fmtDate(o.data_previsao)}</div>}
              </Link>
            )
          })}
        </div>
      )}

      {showForm && (
        <ObraFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refresh() }}
        />
      )}
    </div>
  )
}
