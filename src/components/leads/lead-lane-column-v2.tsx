'use client'

import { MessageCircle, MoreHorizontal, GripVertical, Flame } from 'lucide-react'
import type { Lead, LeadStatus } from '@/types/database'
import { featureFlags } from '@/lib/feature-flags'
import { fmt } from '@/lib/utils'
import type { DragEvent } from 'react'

interface LeadLaneColumnV2Props {
  laneId: LeadStatus
  title: string
  badgeClassName: string
  countToneClassName: string
  leads: Lead[]
  dragOver: boolean
  onDragOver: (event: DragEvent) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent, laneId: LeadStatus) => void
  onDragStart: (leadId: string) => void
  onDragEnd: () => void
  onOpenLead: (lead: Lead) => void
  nowMs: number
}

function whatsappUrl(phone: string) {
  return `https://wa.me/55${phone.replace(/\D/g, '')}`
}

function stageTone(status: LeadStatus) {
  if (status === 'Qualificado') return 'border-amber-300 bg-amber-50/40'
  if (status === 'Proposta') return 'border-sky-300 bg-sky-50/40'
  if (status === 'Fechado') return 'border-emerald-300 bg-emerald-50/40'
  return 'border-gray-200 bg-white'
}

export function LeadLaneColumnV2({
  laneId,
  title,
  badgeClassName,
  countToneClassName,
  leads,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onOpenLead,
  nowMs,
}: LeadLaneColumnV2Props) {
  function getProposalProgress(lead: Lead) {
    if (!featureFlags.leadsProgressV2) {
      return { width: 62, label: 'Enviada' }
    }

    let progress = 22
    if ((lead.valor_potencial || 0) > 0) progress += 23
    if (lead.temperatura === 'Hot') progress += 22
    if (lead.temperatura === 'Morno') progress += 14

    if (lead.ultimo_contato) {
      const diffHours = (nowMs - new Date(lead.ultimo_contato).getTime()) / (1000 * 60 * 60)
      if (diffHours <= 24) progress += 30
      else if (diffHours <= 72) progress += 20
      else progress += 8
    } else {
      progress += 4
    }

    const width = Math.max(15, Math.min(Math.round(progress), 98))
    let label = 'Em preparação'
    if (width >= 75) label = 'Em revisão'
    if (width >= 90) label = 'Pronta para fechamento'
    return { width, label }
  }

  return (
    <section
      className={`min-w-[280px] snap-center rounded-3xl border p-4 transition-all md:min-w-0 ${
        dragOver
          ? 'border-sand-400 bg-sand-50/70 ring-2 ring-sand-300 dark:border-sand-700 dark:bg-sand-900/20'
          : 'border-gray-200 bg-white/70 dark:border-gray-800 dark:bg-gray-900/40'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(event) => onDrop(event, laneId)}
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${badgeClassName}`} />
          <h3 className="text-[1.45rem] font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
        <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${countToneClassName}`}>
          {leads.length}
        </span>
      </header>

      <div className="space-y-2.5">
        {leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-3 py-5 text-center text-xs text-gray-400 dark:border-gray-700">
            Nenhum lead nesta etapa
          </div>
        ) : (
          leads.map((lead) => (
            <article
              key={lead.id}
              draggable
              onDragStart={() => onDragStart(lead.id)}
              onDragEnd={onDragEnd}
              onClick={() => onOpenLead(lead)}
              className={`lead-lane-card cursor-grab p-3 transition-all active:cursor-grabbing hover:shadow-md ${stageTone(lead.status)}`}
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[1.15rem] font-semibold text-gray-900 dark:text-gray-100">{lead.nome}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{lead.tipo_projeto || 'Projeto não informado'}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-2 flex items-center justify-between">
                <p className="text-lg font-semibold text-sand-600 dark:text-sand-300">{fmt(lead.valor_potencial || 0)}</p>
                {lead.status === 'Qualificado' ? (
                  <button
                    type="button"
                    className="rounded-xl bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-amber-600"
                    onClick={(event) => {
                      event.stopPropagation()
                      if (lead.telefone) window.open(whatsappUrl(lead.telefone), '_blank', 'noopener,noreferrer')
                    }}
                  >
                    Ligar
                  </button>
                ) : null}
              </div>

              {lead.status === 'Proposta' ? (
                <div className="mb-2">
                  {(() => {
                    const proposalProgress = getProposalProgress(lead)
                    return (
                      <>
                        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-1.5 rounded-full bg-ocean-500 transition-all duration-200"
                            style={{ width: `${proposalProgress.width}%` }}
                          />
                        </div>
                        <p className="mt-1 text-right text-xs font-semibold text-ocean-600 dark:text-ocean-300">
                          {proposalProgress.label}
                        </p>
                      </>
                    )
                  })()}
                </div>
              ) : null}

              <div className="flex items-center justify-between pt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <GripVertical className="h-3.5 w-3.5 text-gray-300" />
                  {lead.ultimo_contato ? 'Ativo' : 'Novo'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-rose-500" />
                  {lead.temperatura}
                </span>
              </div>

              {lead.telefone ? (
                <div className="mt-1.5 flex justify-end">
                  <a
                    href={whatsappUrl(lead.telefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  )
}
