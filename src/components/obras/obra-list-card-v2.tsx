'use client'

import Link from 'next/link'
import { fmt, fmtDate } from '@/lib/utils'
import type { Obra } from '@/types/database'

interface ObraListCardV2Props {
  obra: Obra
  onUpdate?: (obra: Obra) => void
}

function getCoverTone(status: Obra['status']) {
  if (status === 'Em Andamento') return 'obra-card-cover-ocean'
  if (status === 'Orçamento') return 'obra-card-cover-sand'
  return 'obra-card-cover-gray'
}

function getStatusBadge(status: Obra['status']) {
  if (status === 'Em Andamento') return 'bg-amber-100 text-amber-700'
  if (status === 'Concluída') return 'bg-emerald-100 text-emerald-700'
  if (status === 'Pausada') return 'bg-rose-100 text-rose-700'
  if (status === 'Orçamento') return 'bg-sky-100 text-sky-700'
  return 'bg-gray-100 text-gray-700'
}

function initials(label: string) {
  return label
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')
}

export function ObraListCardV2({ obra, onUpdate }: ObraListCardV2Props) {
  const progress = Math.max(0, Math.min(100, obra.progresso || 0))
  const coverTone = getCoverTone(obra.status)
  const memberA = initials(obra.cliente || 'CL')
  const memberB = initials(obra.etapa_atual || 'OB')

  return (
    <article className="overflow-hidden rounded-[1.8rem] border border-gray-200 bg-white shadow-[var(--ui-shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--ui-shadow-hover)] dark:border-gray-800 dark:bg-gray-950">
      <div className={`obra-card-cover ${coverTone} relative px-5 py-4`}>
        <div className="absolute right-5 top-4 rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-gray-700">
          {progress}% Concluído
        </div>
        <div className="absolute bottom-4 left-5 flex items-center gap-1.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-[#f0e28f] text-xs font-semibold text-gray-700">
            {memberA}
          </span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-[#90cff7] text-xs font-semibold text-gray-700">
            {memberB}
          </span>
        </div>
      </div>

      <div className="space-y-3 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[1.8rem] font-semibold leading-tight text-gray-900 dark:text-gray-100">{obra.nome}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{obra.local || 'Local não informado'}</p>
          </div>
          <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{fmt(obra.valor_contrato)}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <p className="text-gray-500 dark:text-gray-400">Área</p>
          <p className="text-right font-medium text-gray-900 dark:text-gray-100">{obra.area_m2 ? `${obra.area_m2}m²` : '—'}</p>

          <p className="text-gray-500 dark:text-gray-400">Fase atual</p>
          <p className="text-right font-medium text-ocean-600 dark:text-ocean-400">{obra.etapa_atual || 'Planejamento'}</p>

          <p className="text-gray-500 dark:text-gray-400">Entrega</p>
          <p className="text-right font-medium text-amber-600 dark:text-amber-400">{obra.data_previsao ? fmtDate(obra.data_previsao) : 'Sem previsão'}</p>
        </div>

        <div className="flex items-center justify-between">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(obra.status)}`}>{obra.status}</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{progress}%</span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div className="h-full rounded-full bg-gradient-to-r from-sand-500 to-ocean-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href={`/obras/${obra.id}`}
            className="inline-flex items-center justify-center rounded-2xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Detalhes
          </Link>
          <button
            type="button"
            onClick={() => onUpdate?.(obra)}
            className="inline-flex items-center justify-center rounded-2xl bg-sand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sand-600"
          >
            Atualizar
          </button>
        </div>
      </div>
    </article>
  )
}
