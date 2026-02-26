'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate } from '@/lib/utils'
import { OBRA_STATUS_COLORS, OBRA_ICON_COLORS } from '@/lib/constants'
import { Plus, HardHat, Home, Building, TreePine, Search } from 'lucide-react'
import { ObraFormModal } from './obra-form-modal'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import { featureFlags } from '@/lib/feature-flags'
import { ObraListCardV2 } from './obra-list-card-v2'
import type { Obra, ObraStatus } from '@/types/database'

const obraIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  building: Building,
  'tree-pine': TreePine,
}

const STATUS_OPTIONS: ('Todas' | ObraStatus)[] = ['Todas', 'Em Andamento', 'Orçamento', 'Pausada', 'Concluída', 'Cancelada']

export function ObrasContent({ initialObras }: { initialObras: Obra[] }) {
  const [obras, setObras] = useState(initialObras)
  const [showForm, setShowForm] = useState(false)
  const [editingObra, setEditingObra] = useState<Obra | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Todas' | ObraStatus>('Todas')
  const supabase = createClient()
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Obras

  async function refresh() {
    const { data } = await supabase.from('obras').select('*').order('created_at', { ascending: false })
    if (data) setObras(data)
  }

  const filtered = useMemo(() => {
    return obras.filter((o) => {
      if (statusFilter !== 'Todas' && o.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!o.nome.toLowerCase().includes(q) && !o.cliente.toLowerCase().includes(q) && !o.local.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [obras, search, statusFilter])

  return (
    <div className="tailadmin-page space-y-4">
      <PageHeader
        title="Gestão de Obras"
        subtitle={`${filtered.length} obras visualizadas`}
        actions={
          <QuickActionBar
            actions={[{
              label: 'Nova Obra',
              icon: <Plus className="h-4 w-4" />,
              onClick: () => {
                setEditingObra(null)
                setShowForm(true)
              },
              tone: 'warning',
            }]}
          />
        }
      />

      {/* Search & Filters */}
      <SectionCard className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, cliente ou local..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          {useV2 ? (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'Todas' | ObraStatus)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm sm:w-auto dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 'Todas' ? 'Todas as obras' : s}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                    statusFilter === s ? 'bg-sand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {filtered.length === 0 ? (
        <EmptyStateAction
          icon={<HardHat className="h-6 w-6 text-sand-600 dark:text-sand-300" />}
          title={obras.length === 0 ? 'Nenhuma obra cadastrada ainda' : 'Nenhuma obra encontrada'}
          description="Cadastre uma obra para acompanhar progresso, etapas e custo em tempo real."
          actionLabel="Criar obra"
          onAction={() => {
            setEditingObra(null)
            setShowForm(true)
          }}
        />
      ) : useV2 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((obra) => (
            <ObraListCardV2 key={obra.id} obra={obra} onUpdate={(item) => {
              setEditingObra(item)
              setShowForm(true)
            }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {filtered.map((o) => {
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

      {useV2 ? (
        <button
          type="button"
          onClick={() => {
            setEditingObra(null)
            setShowForm(true)
          }}
          className="fixed bottom-5 right-5 z-20 inline-flex items-center gap-2 rounded-2xl bg-sand-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sand-500/30 transition hover:bg-sand-600 sm:hidden"
        >
          <Plus className="h-4 w-4" />
          Nova Obra
        </button>
      ) : null}

      {showForm && (
        <ObraFormModal
          obra={editingObra || undefined}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setEditingObra(null)
            setShowForm(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
