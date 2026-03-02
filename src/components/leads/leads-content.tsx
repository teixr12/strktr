'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useConfirm } from '@/hooks/use-confirm'
import { toast } from '@/hooks/use-toast'
import { useCrudMutations } from '@/hooks/use-crud-mutations'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import { track } from '@/lib/analytics/client'
import { fmt, fmtDate } from '@/lib/utils'
import { KANBAN_COLUMNS, TEMPERATURA_EMOJI, TEMPERATURA_COLORS } from '@/lib/constants'
import { Plus, X, MessageCircle, Trash2, Edit2, GripVertical, Search } from 'lucide-react'
import { featureFlags } from '@/lib/feature-flags'
import { ModalSheet } from '@/components/ui/modal-sheet'
import { FormField, FormInput, FormTextarea, FormSelect } from '@/components/ui/form-field'
import {
  PageHeader,
  PaginationControls,
  QuickActionBar,
  SectionCard,
  StatBadge,
} from '@/components/ui/enterprise'
import { LeadLaneColumnV2 } from './lead-lane-column-v2'
import { LeadInteractionsTableV2 } from './lead-interactions-table-v2'
import type { Lead, LeadStatus } from '@/types/database'

interface Props { initialLeads: Lead[] }

const TIPO_OPTIONS = ['Residencial', 'Comercial', 'Industrial', 'Reforma', 'Outro']
interface LeadsSlaSummary {
  totalParados: number
  slaHours: number
  severity: 'low' | 'medium' | 'high'
}

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

const PAGE_SIZE = 50

const V2_LANES: Array<{
  id: LeadStatus
  title: string
  dotClass: string
  countToneClass: string
}> = [
  { id: 'Novo', title: 'Novo Lead', dotClass: 'bg-gray-400', countToneClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200' },
  { id: 'Qualificado', title: 'Qualificado', dotClass: 'bg-amber-500', countToneClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' },
  { id: 'Proposta', title: 'Proposta', dotClass: 'bg-ocean-500', countToneClass: 'bg-ocean-100 text-ocean-700 dark:bg-ocean-900/40 dark:text-ocean-200' },
  { id: 'Fechado', title: 'Fechado', dotClass: 'bg-emerald-500', countToneClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' },
]

const leadFormSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do lead é obrigatório'),
  email: z.string().email('Email inválido').or(z.literal('')).optional(),
  telefone: z.string().trim().optional(),
  tipo_projeto: z.string().trim().optional(),
  valor_potencial: z.string().optional(),
  temperatura: z.enum(['Hot', 'Morno', 'Frio']).default('Morno'),
  origem: z.string().trim().min(2, 'Origem é obrigatória'),
  notas: z.string().trim().optional(),
  status: z.enum(['Novo', 'Qualificado', 'Proposta', 'Negociação', 'Fechado', 'Perdido']).default('Novo'),
})
type LeadFormValues = z.infer<typeof leadFormSchema>

export function LeadsContent({ initialLeads }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const usePaginationV1 = featureFlags.uiPaginationV1
  const [leads, setLeads] = useState(initialLeads)
  const [pagination, setPagination] = useState<PaginationMeta>({
    count: initialLeads.length,
    page: 1,
    pageSize: PAGE_SIZE,
    total: initialLeads.length,
    hasMore: false,
  })
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [nextAction, setNextAction] = useState<Record<string, string>>({})
  const [nowMs, setNowMs] = useState(() => Date.now())
  const dragRef = useRef<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sla, setSla] = useState<LeadsSlaSummary | null>(null)
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Leads

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema) as never,
    defaultValues: {
      nome: '', email: '', telefone: '', tipo_projeto: 'Residencial',
      valor_potencial: '', temperatura: 'Morno', origem: 'Indicação', notas: '', status: 'Novo',
    },
  })

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<Lead>({
    setItems: setLeads,
    basePath: '/api/v1/leads',
    entityName: 'Lead',
    trackSource: 'leads',
    trackEntityType: 'lead',
    onSettled: usePaginationV1 ? () => refreshLeads(pagination.page) : undefined,
  })

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    async function loadSla() {
      try {
        const data = await apiRequest<LeadsSlaSummary>('/api/v1/leads/sla')
        setSla(data)
      } catch {
        setSla(null)
      }
    }

    loadSla()
    const timer = setInterval(loadSla, 60_000)
    return () => clearInterval(timer)
  }, [])

  async function refreshLeads(targetPage = 1) {
    if (!usePaginationV1) {
      try {
        const data = await apiRequest<Lead[]>('/api/v1/leads?limit=200')
        setLeads(data)
        setLoadError(null)
      } catch {
        setLeads([])
        setLoadError('Erro ao carregar leads')
      }
      return
    }

    setIsPageLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      })
      const payload = await apiRequestWithMeta<Lead[], PaginationMeta>(`/api/v1/leads?${params.toString()}`)
      setLeads(payload.data)
      setPagination(
        payload.meta || {
          count: payload.data.length,
          page: targetPage,
          pageSize: PAGE_SIZE,
          total: payload.data.length,
          hasMore: false,
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao recarregar leads'
      setLoadError(message)
      toast(message, 'error')
    } finally {
      setIsPageLoading(false)
    }
  }

  useEffect(() => {
    if (!usePaginationV1) return
    void refreshLeads(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePaginationV1])

  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads
    const q = searchQuery.toLowerCase()
    return leads.filter((l) =>
      l.nome.toLowerCase().includes(q) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.telefone && l.telefone.includes(q)) ||
      (l.tipo_projeto && l.tipo_projeto.toLowerCase().includes(q))
    )
  }, [leads, searchQuery])
  const overdueLeadsCount = useMemo(() => {
    return filteredLeads.filter((lead) => {
      if (!lead.ultimo_contato || lead.status === 'Fechado' || lead.status === 'Perdido') return false
      const hours = (nowMs - new Date(lead.ultimo_contato).getTime()) / (1000 * 60 * 60)
      return hours >= 48
    }).length
  }, [filteredLeads, nowMs])

  function openNew() {
    reset({
      nome: '', email: '', telefone: '', tipo_projeto: 'Residencial',
      valor_potencial: '', temperatura: 'Morno', origem: 'Indicação', notas: '', status: 'Novo',
    })
    setEditLead(null)
    setShowForm(true)
  }

  function openEdit(l: Lead) {
    reset({
      nome: l.nome,
      email: l.email || '',
      telefone: l.telefone || '',
      tipo_projeto: l.tipo_projeto || 'Residencial',
      valor_potencial: l.valor_potencial ? String(l.valor_potencial) : '',
      temperatura: l.temperatura,
      origem: l.origem,
      notas: l.notas || '',
      status: l.status,
    })
    setEditLead(l)
    setDetailLead(null)
    setShowForm(true)
  }

  async function onSubmit(values: LeadFormValues) {
    const payload = {
      nome: values.nome.trim(),
      email: values.email || null,
      telefone: values.telefone || null,
      tipo_projeto: values.tipo_projeto || null,
      valor_potencial: values.valor_potencial ? parseFloat(values.valor_potencial) : null,
      temperatura: values.temperatura,
      origem: values.origem,
      notas: values.notas || null,
      status: values.status,
    }

    let ok: boolean
    if (editLead) {
      ok = await updateMutation.mutate(payload, editLead.id)
    } else {
      ok = await createMutation.mutate(payload)
    }
    if (ok) {
      setShowForm(false)
      setEditLead(null)
    }
  }

  async function deleteLead(id: string) {
    const ok = await confirm({ title: 'Excluir lead?', description: 'Essa ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' })
    if (!ok) return
    const success = await deleteMutation.mutate(undefined, id)
    if (success) setDetailLead(null)
  }

  async function updateStatus(id: string, status: LeadStatus) {
    try {
      const data = await apiRequest<Lead>(`/api/v1/leads/${id}`, { method: 'PUT', body: { status } })
      setLeads((prev) => prev.map((l) => l.id === id ? data : l))
      if (usePaginationV1) {
        await refreshLeads(pagination.page)
      }
      track('core_move', {
        source: 'leads',
        entity_type: 'lead_status',
        entity_id: id,
        outcome: 'success',
        to_status: status,
      }).catch(() => undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao mover lead'
      toast(message, 'error')
    }
  }

  async function suggestNextAction(id: string) {
    try {
      const data = await apiRequest<{ recommendation: string }>(`/api/v1/leads/${id}/next-action`, { method: 'POST' })
      setNextAction((prev) => ({ ...prev, [id]: data.recommendation }))
      toast('Próxima ação gerada', 'success')
      track('core_complete', {
        source: 'leads',
        entity_type: 'lead_next_action',
        entity_id: id,
        outcome: 'success',
      }).catch(() => undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao sugerir próxima ação'
      toast(message, 'error')
    }
  }

  function isSlaLate(lead: Lead) {
    if (!lead.ultimo_contato || lead.status === 'Fechado' || lead.status === 'Perdido') return false
    const hours = (nowMs - new Date(lead.ultimo_contato).getTime()) / (1000 * 60 * 60)
    return hours >= 48
  }

  function handleDragStart(id: string) { dragRef.current = id }
  function handleDragEnd() { dragRef.current = null; setDragOverCol(null) }
  function handleDragOver(e: React.DragEvent, colId: string) { e.preventDefault(); setDragOverCol(colId) }
  function handleDragLeave() { setDragOverCol(null) }
  function handleDrop(e: React.DragEvent, colId: string) {
    e.preventDefault()
    setDragOverCol(null)
    if (dragRef.current) updateStatus(dragRef.current, colId as LeadStatus)
  }

  function whatsappUrl(phone: string) {
    return `https://wa.me/55${phone.replace(/\D/g, '')}`
  }

  return (
    <div className="tailadmin-page space-y-4">
      <PageHeader
        title="Leads VIP"
        subtitle={`${pagination.total || leads.length} leads no pipeline`}
        actions={
          <QuickActionBar
            actions={[{
              label: useV2 ? 'Adicionar Lead' : 'Novo Lead',
              icon: <Plus className="h-4 w-4" />,
              onClick: openNew,
              tone: 'warning',
            }]}
          />
        }
      />

      {sla && sla.totalParados > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <SectionCard className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">SLA Comercial</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {sla.totalParados} parados ({sla.slaHours}h)
                </p>
              </div>
              <StatBadge
                label={sla.severity === 'high' ? 'Crítico' : sla.severity === 'medium' ? 'Atenção' : 'Observação'}
                tone={sla.severity === 'high' ? 'danger' : sla.severity === 'medium' ? 'warning' : 'info'}
              />
            </div>
          </SectionCard>
          <SectionCard className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Ação Rápida</p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {overdueLeadsCount > 0
                    ? `${overdueLeadsCount} lead(s) com risco de SLA`
                    : 'Pipeline sem risco imediato'}
                </p>
              </div>
              {overdueLeadsCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = filteredLeads.find((lead) => isSlaLate(lead))
                    if (target) setDetailLead(target)
                  }}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                >
                  Resolver agora
                </button>
              ) : null}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {/* Search */}
      <SectionCard className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar leads por nome, email, telefone..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </SectionCard>

      {loadError ? (
        <SectionCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <button
              type="button"
              onClick={() => void refreshLeads(pagination.page || 1)}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Tentar novamente
            </button>
          </div>
        </SectionCard>
      ) : null}

      {useV2 ? (
        <>
          {isPageLoading && filteredLeads.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton h-[220px] w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="kanban-scroll-hint flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-4">
              {V2_LANES.map((lane) => (
                <LeadLaneColumnV2
                  key={lane.id}
                  laneId={lane.id}
                  title={lane.title}
                  badgeClassName={lane.dotClass}
                  countToneClassName={lane.countToneClass}
                  leads={filteredLeads.filter((lead) => lead.status === lane.id)}
                  dragOver={dragOverCol === lane.id}
                  onDragOver={(event) => handleDragOver(event, lane.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onOpenLead={setDetailLead}
                onSuggestNextAction={suggestNextAction}
                nowMs={nowMs}
              />
            ))}
            </div>
          )}

          <SectionCard title="Histórico de Interações" className="p-4 md:p-5">
            <LeadInteractionsTableV2 leads={filteredLeads} />
          </SectionCard>
        </>
      ) : (
        <div className="kanban-scroll-hint flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory">
          {KANBAN_COLUMNS.map((col) => {
            const colLeads = filteredLeads.filter((l) => l.status === col.id)
            const total = colLeads.reduce((s, l) => s + (l.valor_potencial || 0), 0)
            return (
              <div
                key={col.id}
                className={`flex-shrink-0 w-[280px] snap-center rounded-2xl p-3 transition-all ${
                  dragOverCol === col.id ? 'ring-2 ring-sand-400 bg-sand-50/50 dark:bg-sand-900/10' : 'bg-gray-50/80 dark:bg-gray-800/30'
                }`}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.dot }} />
                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{col.label}</span>
                    <span className="text-xs text-gray-400 bg-gray-200/60 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{colLeads.length}</span>
                  </div>
                  {total > 0 && <span className="text-xs font-medium text-gray-500">{fmt(total)}</span>}
                </div>

                <div className="space-y-2 min-h-[60px]">
                  {colLeads.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhum lead</p>
                  ) : (
                    colLeads.map((l) => (
                      <div
                        key={l.id}
                        draggable
                        onDragStart={() => handleDragStart(l.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setDetailLead(l)}
                        className="glass-card rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                            <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{l.nome}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isSlaLate(l) && (
                              <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                                SLA
                              </span>
                            )}
                            <span className="text-sm flex-shrink-0">{TEMPERATURA_EMOJI[l.temperatura] || '🌤'}</span>
                          </div>
                        </div>
                        {l.tipo_projeto && <p className="text-xs text-gray-500 mb-1">{l.tipo_projeto}</p>}
                        <div className="flex items-center justify-between">
                          {l.valor_potencial ? (
                            <span className="text-xs font-semibold text-sand-600 dark:text-sand-400">{fmt(l.valor_potencial)}</span>
                          ) : <span />}
                          {l.telefone && (
                            <a href={whatsappUrl(l.telefone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 text-emerald-500 hover:text-emerald-600 transition-colors">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {usePaginationV1 ? (
        <SectionCard className="p-3">
          <PaginationControls
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            hasMore={pagination.hasMore}
            isLoading={isPageLoading}
            onPrev={() => void refreshLeads(Math.max(1, pagination.page - 1))}
            onNext={() => void refreshLeads(pagination.page + 1)}
          />
          {searchQuery ? (
            <p className="pt-2 text-xs text-gray-500 dark:text-gray-400">
              Busca aplicada na página atual.
            </p>
          ) : null}
        </SectionCard>
      ) : null}

      {/* Detail Modal */}
      {detailLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetailLead(null)}>
          <div className="modal-glass modal-animate w-full max-w-md rounded-3xl shadow-2xl dark:bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{detailLead.nome}</h3>
                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${TEMPERATURA_COLORS[detailLead.temperatura]}`}>
                  {TEMPERATURA_EMOJI[detailLead.temperatura]} {detailLead.temperatura}
                </span>
              </div>
              <button onClick={() => setDetailLead(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-2.5 text-sm">
              {detailLead.email && <div><span className="text-gray-500">Email:</span> <span className="text-gray-900 dark:text-white">{detailLead.email}</span></div>}
              {detailLead.telefone && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Telefone:</span>
                  <span className="text-gray-900 dark:text-white">{detailLead.telefone}</span>
                  <a href={whatsappUrl(detailLead.telefone)} target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-600"><MessageCircle className="w-4 h-4" /></a>
                </div>
              )}
              {detailLead.empresa && <div><span className="text-gray-500">Empresa:</span> <span className="text-gray-900 dark:text-white">{detailLead.empresa}</span></div>}
              {detailLead.tipo_projeto && <div><span className="text-gray-500">Tipo:</span> <span className="text-gray-900 dark:text-white">{detailLead.tipo_projeto}</span></div>}
              {detailLead.valor_potencial && <div><span className="text-gray-500">Valor:</span> <span className="font-semibold text-sand-600">{fmt(detailLead.valor_potencial)}</span></div>}
              {detailLead.origem && <div><span className="text-gray-500">Origem:</span> <span className="text-gray-900 dark:text-white">{detailLead.origem}</span></div>}
              {detailLead.notas && <div><span className="text-gray-500">Notas:</span><p className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-line">{detailLead.notas}</p></div>}
              <div><span className="text-gray-500">Criado:</span> <span className="text-gray-900 dark:text-white">{fmtDate(detailLead.created_at)}</span></div>
              {nextAction[detailLead.id] && (
                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
                  <span className="text-xs text-blue-600 dark:text-blue-300 font-semibold">Próxima melhor ação</span>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">{nextAction[detailLead.id]}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => suggestNextAction(detailLead.id)} className="flex-1 py-2.5 bg-ocean-500 hover:bg-ocean-600 text-white font-medium rounded-2xl transition-all text-sm">
                Next Action
              </button>
              <button onClick={() => openEdit(detailLead)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm">
                <Edit2 className="w-4 h-4" /> Editar
              </button>
              <button onClick={() => deleteLead(detailLead.id)} className="flex items-center justify-center gap-2 py-2.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 text-red-600 font-medium rounded-2xl transition-all text-sm">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <ModalSheet open={showForm} onClose={() => { setShowForm(false); setEditLead(null) }} title={editLead ? 'Editar Lead' : 'Novo Lead'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <FormField label="Nome" error={errors.nome} required>
            <FormInput registration={register('nome')} hasError={!!errors.nome} placeholder="Nome do lead" />
          </FormField>

          <FormField label="Email" error={errors.email}>
            <FormInput registration={register('email')} hasError={!!errors.email} placeholder="Email" type="email" />
          </FormField>

          <FormField label="Telefone" error={errors.telefone}>
            <FormInput registration={register('telefone')} hasError={!!errors.telefone} placeholder="Telefone" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tipo de Projeto">
              <FormSelect registration={register('tipo_projeto')}>
                {TIPO_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Valor (R$)">
              <FormInput registration={register('valor_potencial')} placeholder="Valor" type="number" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Temperatura">
              <FormSelect registration={register('temperatura')}>
                <option value="Hot">🔥 Hot</option>
                <option value="Morno">🌤 Morno</option>
                <option value="Frio">❄️ Frio</option>
              </FormSelect>
            </FormField>
            <FormField label="Status">
              <FormSelect registration={register('status')}>
                {KANBAN_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </FormSelect>
            </FormField>
          </div>

          <FormField label="Origem" error={errors.origem} required>
            <FormInput registration={register('origem')} hasError={!!errors.origem} placeholder="Origem (ex: Indicação, Instagram)" />
          </FormField>

          <FormField label="Notas">
            <FormTextarea registration={register('notas')} placeholder="Notas" rows={3} />
          </FormField>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditLead(null) }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
            <button type="submit" disabled={createMutation.isMutating || updateMutation.isMutating} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 disabled:opacity-50 text-white font-medium rounded-2xl btn-press transition-all text-sm">
              {createMutation.isMutating || updateMutation.isMutating ? 'Salvando...' : editLead ? 'Salvar' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </ModalSheet>

      {confirmDialog}
    </div>
  )
}
