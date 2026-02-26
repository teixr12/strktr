'use client'

import { DataTable, StatBadge } from '@/components/ui/enterprise'
import { fmt } from '@/lib/utils'
import type { Lead } from '@/types/database'
import type { InteractionRowViewModel, UiDataColumn, UiStatusTone } from '@/shared/types/ui'

interface LeadInteractionsTableV2Props {
  leads: Lead[]
}

function statusTone(status: string): UiStatusTone {
  if (status === 'Fechado') return 'success'
  if (status === 'Proposta' || status === 'Negociação') return 'info'
  if (status === 'Perdido') return 'danger'
  if (status === 'Qualificado') return 'warning'
  return 'neutral'
}

function fmtLastContact(value: string | null) {
  if (!value) return 'Sem contato'
  const date = new Date(value)
  const today = new Date()
  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return `Hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  if (diffDays === 1) return `Ontem, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function LeadInteractionsTableV2({ leads }: LeadInteractionsTableV2Props) {
  const rows: InteractionRowViewModel[] = leads
    .slice()
    .sort((a, b) => (b.ultimo_contato || b.created_at).localeCompare(a.ultimo_contato || a.created_at))
    .slice(0, 12)
    .map((lead) => ({
      id: lead.id,
      clientName: lead.nome,
      clientMeta: lead.email || lead.tipo_projeto || 'Sem detalhe',
      originLabel: lead.origem || 'Não informado',
      statusLabel: lead.status,
      statusTone: statusTone(lead.status),
      estimatedValueLabel: fmt(lead.valor_potencial || 0),
      lastContactLabel: fmtLastContact(lead.ultimo_contato),
    }))

  const columns: UiDataColumn<InteractionRowViewModel>[] = [
    {
      key: 'cliente',
      header: 'Cliente',
      cell: (row) => (
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{row.clientName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.clientMeta}</p>
        </div>
      ),
    },
    {
      key: 'origem',
      header: 'Origem',
      cell: (row) => <span>{row.originLabel}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatBadge label={row.statusLabel} tone={row.statusTone} />,
    },
    {
      key: 'valor',
      header: 'Valor Est.',
      cell: (row) => <span className="font-semibold text-gray-900 dark:text-gray-100">{row.estimatedValueLabel}</span>,
    },
    {
      key: 'contato',
      header: 'Último Contato',
      cell: (row) => <span>{row.lastContactLabel}</span>,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="hidden md:block">
        <DataTable columns={columns} rows={rows} emptyMessage="Nenhuma interação registrada" />
      </div>

      <div className="space-y-2 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Nenhuma interação registrada
          </div>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{row.clientName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{row.clientMeta}</p>
                </div>
                <StatBadge label={row.statusLabel} tone={row.statusTone} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                <p>Origem: {row.originLabel}</p>
                <p className="text-right font-semibold text-gray-900 dark:text-gray-100">{row.estimatedValueLabel}</p>
              </div>
              <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">{row.lastContactLabel}</p>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
