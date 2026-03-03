'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, RefreshCw, FileDown, Link2 } from 'lucide-react'
import { z } from 'zod'
import { apiRequest } from '@/lib/api/client'
import { track } from '@/lib/analytics/client'
import { toast } from '@/hooks/use-toast'
import {
  createCronogramaItemSchema,
  inviteClientPortalSchema,
} from '@/shared/schemas/cronograma-portal'

function fmtDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

const WEEK_DAY_OPTIONS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
]

type CronogramaPayload = {
  obra: { id: string; nome: string }
  cronograma: {
    id: string
    nome: string
    calendario?: {
      dias_uteis?: number[]
      feriados?: string[]
    } | null
    data_inicio_planejada: string | null
    data_fim_planejada: string | null
  }
  itens: Array<{
    id: string
    nome: string
    status: 'pendente' | 'em_andamento' | 'concluido' | 'bloqueado'
    empresa_responsavel: string | null
    responsavel: string | null
    data_inicio_planejada: string | null
    data_fim_planejada: string | null
    duracao_dias: number
    atraso_dias: number
    progresso: number
    ordem: number
  }>
  summary: {
    totalItems: number
    delayedItems: number
    blockedItems: number
    projectedEndDate: string | null
  }
}

type InviteResult = {
  portalUrl: string
  expiresAt: string
  emailSent: boolean
}

type CronogramaItem = CronogramaPayload['itens'][number]
type CronogramaViewMode = 'list' | 'timeline' | 'calendar' | 'board'

const STATUS_LABELS: Record<CronogramaItem['status'], string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  bloqueado: 'Bloqueado',
}

interface Props {
  obraId: string
}

type CreateCronogramaItemFormValues = z.input<typeof createCronogramaItemSchema>
type InviteClientPortalFormValues = z.input<typeof inviteClientPortalSchema>

export function ObraCronogramaTab({ obraId }: Props) {
  const cronogramaEnabled = process.env.NEXT_PUBLIC_FF_CRONOGRAMA_ENGINE === 'true'
  const cronogramaViewsEnabled =
    process.env.NEXT_PUBLIC_FF_CRONOGRAMA_VIEWS_V1 === 'true'
  const portalEnabled = process.env.NEXT_PUBLIC_FF_CLIENT_PORTAL === 'true'
  const pdfEnabled = process.env.NEXT_PUBLIC_FF_CRONOGRAMA_PDF === 'true'

  const [loading, setLoading] = useState(false)
  const [payload, setPayload] = useState<CronogramaPayload | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Partial<CronogramaPayload['itens'][number]>>>({})
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)
  const [calendarDays, setCalendarDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [holidayInput, setHolidayInput] = useState('')
  const [viewMode, setViewMode] = useState<CronogramaViewMode>('list')

  const createForm = useForm<CreateCronogramaItemFormValues>({
    resolver: zodResolver(createCronogramaItemSchema),
    defaultValues: {
      nome: '',
      tipo: 'tarefa',
      status: 'pendente',
      duracao_dias: 1,
      progresso: 0,
      empresa_responsavel: '',
      responsavel: '',
      data_inicio_planejada: null,
      data_fim_planejada: null,
    },
  })

  const inviteForm = useForm<InviteClientPortalFormValues>({
    resolver: zodResolver(inviteClientPortalSchema),
    defaultValues: {
      nome: '',
      email: '',
      telefone: '',
      expiresInDays: 30,
    },
  })

  const loadCronograma = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest<CronogramaPayload>(`/api/v1/obras/${obraId}/cronograma`)
      setPayload(data)
      const nextDays = data.cronograma?.calendario?.dias_uteis || [1, 2, 3, 4, 5]
      const uniqueDays = Array.from(new Set(nextDays)).filter((value) => value >= 0 && value <= 6)
      setCalendarDays(uniqueDays.length > 0 ? uniqueDays : [1, 2, 3, 4, 5])
      setHolidayInput((data.cronograma?.calendario?.feriados || []).join(', '))
      const nextDrafts: Record<string, Partial<CronogramaPayload['itens'][number]>> = {}
      for (const item of data.itens || []) {
        nextDrafts[item.id] = {
          nome: item.nome,
          status: item.status,
          empresa_responsavel: item.empresa_responsavel,
          responsavel: item.responsavel,
          data_inicio_planejada: item.data_inicio_planejada,
          data_fim_planejada: item.data_fim_planejada,
          duracao_dias: item.duracao_dias,
          progresso: item.progresso,
        }
      }
      setDrafts(nextDrafts)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao carregar cronograma', 'error')
    } finally {
      setLoading(false)
    }
  }, [obraId])

  useEffect(() => {
    if (!cronogramaEnabled) return
    void loadCronograma()
  }, [cronogramaEnabled, loadCronograma])

  async function createItem(values: CreateCronogramaItemFormValues) {
    try {
      const payload = {
        ...values,
        data_inicio_planejada: values.data_inicio_planejada || null,
        data_fim_planejada: values.data_fim_planejada || null,
        empresa_responsavel: values.empresa_responsavel || null,
        responsavel: values.responsavel || null,
      }
      await apiRequest(`/api/v1/obras/${obraId}/cronograma/items`, {
        method: 'POST',
        body: payload,
      })
      toast('Item do cronograma criado', 'success')
      createForm.reset({
        nome: '',
        tipo: 'tarefa',
        status: 'pendente',
        duracao_dias: 1,
        progresso: 0,
        empresa_responsavel: '',
        responsavel: '',
        data_inicio_planejada: null,
        data_fim_planejada: null,
      })
      await loadCronograma()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao criar item', 'error')
    }
  }

  async function saveItem(itemId: string) {
    const draft = drafts[itemId]
    if (!draft) return

    try {
      await apiRequest(`/api/v1/obras/${obraId}/cronograma/items/${itemId}`, {
        method: 'PATCH',
        body: draft,
      })
      toast('Item atualizado', 'success')
      await loadCronograma()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao atualizar item', 'error')
    }
  }

  async function recalculate() {
    try {
      await apiRequest(`/api/v1/obras/${obraId}/cronograma/recalculate`, { method: 'POST' })
      toast('Cronograma recalculado', 'success')
      await loadCronograma()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao recalcular cronograma', 'error')
    }
  }

  async function saveCalendar() {
    try {
      const feriados = holidayInput
        .split(',')
        .map((value) => value.trim())
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))

      await apiRequest(`/api/v1/obras/${obraId}/cronograma`, {
        method: 'PATCH',
        body: {
          calendario: {
            dias_uteis: calendarDays,
            feriados,
          },
        },
      })
      toast('Calendário do cronograma atualizado', 'success')
      await loadCronograma()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao atualizar calendário', 'error')
    }
  }

  function toggleWorkingDay(day: number) {
    setCalendarDays((current) => {
      if (current.includes(day)) {
        const next = current.filter((value) => value !== day)
        return next.length > 0 ? next : current
      }
      return [...current, day].sort((a, b) => a - b)
    })
  }

  async function generatePdf() {
    try {
      const res = await apiRequest<{
        fileName: string
        mimeType: string
        downloadUrl: string | null
        base64: string | null
        fallback: boolean
      }>(
        `/api/v1/obras/${obraId}/cronograma/pdf`,
        { method: 'POST', body: {} }
      )

      if (res.downloadUrl) {
        window.open(res.downloadUrl, '_blank', 'noopener,noreferrer')
        toast('PDF gerado com link seguro', 'success')
        return
      }

      if (!res.base64) {
        toast('Não foi possível gerar o PDF agora', 'error')
        return
      }

      const bytes = atob(res.base64)
      const array = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i)
      const blob = new Blob([array], { type: res.mimeType || 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = res.fileName || `cronograma-${obraId}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      toast('PDF gerado em modo de contingência', 'info')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao gerar PDF', 'error')
    }
  }

  async function inviteClient(values: InviteClientPortalFormValues) {
    try {
      const result = await apiRequest<InviteResult>(`/api/v1/obras/${obraId}/portal/invite`, {
        method: 'POST',
        body: values,
      })
      setInviteResult(result)
      track('portal_invite_sent', {
        source: 'obras',
        entity_type: 'portal_invite',
        entity_id: obraId,
        outcome: 'success',
        email_sent: result.emailSent,
      }).catch(() => undefined)
      toast(result.emailSent ? 'Convite enviado por email' : 'Link do portal gerado', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao gerar convite do portal', 'error')
    }
  }

  async function copyPortalLink() {
    if (!inviteResult?.portalUrl) return
    try {
      await navigator.clipboard.writeText(inviteResult.portalUrl)
      toast('Link copiado', 'success')
    } catch {
      toast('Não foi possível copiar o link', 'error')
    }
  }

  const highRiskItems = useMemo(
    () => (payload?.itens || []).filter((item) => item.atraso_dias > 0 || item.status === 'bloqueado').length,
    [payload?.itens]
  )
  const cronogramaItems = useMemo(() => payload?.itens || [], [payload?.itens])

  const timelineItems = useMemo(
    () =>
      [...cronogramaItems].sort((a, b) => {
        const startA = a.data_inicio_planejada ? new Date(a.data_inicio_planejada).getTime() : Number.MAX_SAFE_INTEGER
        const startB = b.data_inicio_planejada ? new Date(b.data_inicio_planejada).getTime() : Number.MAX_SAFE_INTEGER
        if (startA !== startB) return startA - startB
        return a.ordem - b.ordem
      }),
    [cronogramaItems]
  )

  const calendarBuckets = useMemo(() => {
    const buckets = new Map<string, CronogramaItem[]>()
    for (const item of timelineItems) {
      const keySource = item.data_inicio_planejada || item.data_fim_planejada || 'sem-data'
      const key =
        keySource === 'sem-data'
          ? 'Sem data'
          : new Date(`${keySource}T00:00:00`).toLocaleDateString('pt-BR', {
              month: 'long',
              year: 'numeric',
            })
      const existing = buckets.get(key) || []
      existing.push(item)
      buckets.set(key, existing)
    }
    return Array.from(buckets.entries()).map(([monthLabel, items]) => ({
      monthLabel,
      items,
    }))
  }, [timelineItems])

  const boardColumns = useMemo(() => {
    const columns: Array<{ status: CronogramaItem['status']; title: string; items: CronogramaItem[] }> = [
      { status: 'pendente', title: STATUS_LABELS.pendente, items: [] },
      { status: 'em_andamento', title: STATUS_LABELS.em_andamento, items: [] },
      { status: 'bloqueado', title: STATUS_LABELS.bloqueado, items: [] },
      { status: 'concluido', title: STATUS_LABELS.concluido, items: [] },
    ]
    const map = new Map(columns.map((column) => [column.status, column]))
    for (const item of cronogramaItems) {
      map.get(item.status)?.items.push(item)
    }
    return columns
  }, [cronogramaItems])

  if (!cronogramaEnabled) {
    return <p className="text-sm text-gray-500">Cronograma avançado está desativado por feature flag.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={recalculate}
          className="inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recalcular cronograma
        </button>
        {pdfEnabled && (
          <button
            onClick={generatePdf}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
          >
            <FileDown className="h-3.5 w-3.5" /> Gerar PDF
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando cronograma...</p>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Calendário do cronograma</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEK_DAY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                    calendarDays.includes(option.value)
                      ? 'border-sand-400 bg-sand-100 text-sand-700'
                      : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={calendarDays.includes(option.value)}
                    onChange={() => toggleWorkingDay(option.value)}
                    className="hidden"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <input
              value={holidayInput}
              onChange={(event) => setHolidayInput(event.target.value)}
              placeholder="Feriados (YYYY-MM-DD, separados por vírgula)"
              className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <button
              onClick={saveCalendar}
              className="mt-3 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Salvar calendário
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-white/60 p-3 text-center dark:bg-gray-900/40">
              <p className="text-xs text-gray-500">Itens</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{payload?.summary.totalItems || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/60 p-3 text-center dark:bg-gray-900/40">
              <p className="text-xs text-gray-500">Atrasados</p>
              <p className="text-sm font-semibold text-red-600">{payload?.summary.delayedItems || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/60 p-3 text-center dark:bg-gray-900/40">
              <p className="text-xs text-gray-500">Bloqueados</p>
              <p className="text-sm font-semibold text-amber-600">{payload?.summary.blockedItems || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/60 p-3 text-center dark:bg-gray-900/40">
              <p className="text-xs text-gray-500">Fim projetado</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmtDate(payload?.summary.projectedEndDate)}</p>
            </div>
          </div>

          {cronogramaViewsEnabled ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Visualização
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { id: 'list' as const, label: 'Lista' },
                  { id: 'timeline' as const, label: 'Timeline' },
                  { id: 'calendar' as const, label: 'Calendário' },
                  { id: 'board' as const, label: 'Quadro' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setViewMode(mode.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      viewMode === mode.id
                        ? 'bg-sand-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                Edição completa de itens disponível no modo Lista.
              </p>
            </div>
          ) : null}

          <form onSubmit={createForm.handleSubmit(createItem)} className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/60 p-4">
            <p className="mb-3 text-xs font-semibold text-sand-700">Novo item de cronograma</p>
            <div className="grid gap-2 md:grid-cols-3">
              <input
                {...createForm.register('nome')}
                placeholder="Nome da atividade"
                className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
              />
              <input
                {...createForm.register('empresa_responsavel')}
                placeholder="Empresa executora"
                className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
              />
              <input
                {...createForm.register('responsavel')}
                placeholder="Responsável"
                className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
              />
              <input
                type="date"
                {...createForm.register('data_inicio_planejada')}
                className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
              />
              <input
                type="date"
                {...createForm.register('data_fim_planejada')}
                className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
              />
              <input
                type="number"
                {...createForm.register('duracao_dias', { valueAsNumber: true })}
                placeholder="Duração (dias)"
                className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar item
            </button>
          </form>

          {!cronogramaViewsEnabled || viewMode === 'list' ? (
            <div className="space-y-2">
              {cronogramaItems.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum item no cronograma ainda.</p>
              ) : (
                cronogramaItems.map((item) => {
                  const draft = drafts[item.id] || {}
                  return (
                    <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/40">
                      <div className="grid gap-2 md:grid-cols-6">
                        <input
                          value={String(draft.nome ?? '')}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], nome: event.target.value } }))
                          }
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs md:col-span-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <select
                          value={String(draft.status ?? 'pendente')}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], status: event.target.value as CronogramaPayload['itens'][number]['status'] } }))
                          }
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_andamento">Em andamento</option>
                          <option value="concluido">Concluído</option>
                          <option value="bloqueado">Bloqueado</option>
                        </select>
                        <input
                          value={String(draft.empresa_responsavel ?? '')}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], empresa_responsavel: event.target.value } }))
                          }
                          placeholder="Empresa"
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <input
                          value={String(draft.responsavel ?? '')}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], responsavel: event.target.value } }))
                          }
                          placeholder="Responsável"
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <input
                          type="number"
                          value={Number(draft.duracao_dias ?? 1)}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], duracao_dias: Number(event.target.value || 1) } }))
                          }
                          placeholder="Dias"
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <input
                          type="date"
                          value={String(draft.data_inicio_planejada ?? '')}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], data_inicio_planejada: event.target.value || null } }))
                          }
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <input
                          type="date"
                          value={String(draft.data_fim_planejada ?? '')}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], data_fim_planejada: event.target.value || null } }))
                          }
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={Number(draft.progresso ?? 0)}
                          onChange={(event) =>
                            setDrafts((prev) => ({ ...prev, [item.id]: { ...prev[item.id], progresso: Number(event.target.value || 0) } }))
                          }
                          placeholder="Progresso"
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => saveItem(item.id)}
                          className="rounded-lg bg-gray-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
                        >
                          Salvar
                        </button>
                      </div>
                      {item.atraso_dias > 0 || item.status === 'bloqueado' ? (
                        <p className="mt-2 text-[11px] text-red-500">
                          Atenção: item crítico ({STATUS_LABELS[item.status]}) com atraso de {item.atraso_dias} dia(s)
                        </p>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          ) : null}

          {cronogramaViewsEnabled && viewMode === 'timeline' ? (
            <div className="space-y-2">
              {timelineItems.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum item no cronograma ainda.</p>
              ) : (
                timelineItems.map((item) => (
                  <div
                    key={`timeline-${item.id}`}
                    className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.nome}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-200">
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {fmtDate(item.data_inicio_planejada)} → {fmtDate(item.data_fim_planejada)} · duração {item.duracao_dias} dia(s)
                    </p>
                    <div className="mt-2 h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-sand-500 transition-[width] duration-200"
                        style={{ width: `${Math.max(0, Math.min(100, item.progresso || 0))}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {cronogramaViewsEnabled && viewMode === 'calendar' ? (
            <div className="space-y-3">
              {calendarBuckets.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum item com data planejada.</p>
              ) : (
                calendarBuckets.map((bucket) => (
                  <section
                    key={`calendar-${bucket.monthLabel}`}
                    className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/40"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {bucket.monthLabel}
                    </p>
                    <div className="mt-2 space-y-2">
                      {bucket.items.map((item) => (
                        <div key={`calendar-item-${item.id}`} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{item.nome}</p>
                          <p className="text-xs text-gray-500">
                            {fmtDate(item.data_inicio_planejada)} → {fmtDate(item.data_fim_planejada)} · {STATUS_LABELS[item.status]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          ) : null}

          {cronogramaViewsEnabled && viewMode === 'board' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {boardColumns.map((column) => (
                <section
                  key={`board-${column.status}`}
                  className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/40"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{column.title}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-200">
                      {column.items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {column.items.length === 0 ? (
                      <p className="text-xs text-gray-400">Sem itens</p>
                    ) : (
                      column.items.map((item) => (
                        <div key={`board-item-${item.id}`} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{item.nome}</p>
                          <p className="text-xs text-gray-500">{fmtDate(item.data_fim_planejada)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {portalEnabled && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
              <p className="text-sm font-semibold text-blue-900">Portal do cliente</p>
              <p className="mb-3 text-xs text-blue-700">Convide o cliente para acompanhar cronograma, diário e aprovações.</p>
              <form onSubmit={inviteForm.handleSubmit(inviteClient)} className="grid gap-2 md:grid-cols-4">
                <input
                  {...inviteForm.register('nome')}
                  placeholder="Nome do cliente"
                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  {...inviteForm.register('email')}
                  placeholder="Email"
                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  {...inviteForm.register('telefone')}
                  placeholder="Telefone"
                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm"
                />
                <button className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Gerar acesso
                </button>
              </form>
              {inviteResult ? (
                <div className="mt-3 rounded-xl bg-white p-3">
                  <p className="text-xs text-gray-500">Expira em {new Date(inviteResult.expiresAt).toLocaleString('pt-BR')}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="line-clamp-1 flex-1 rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-700">{inviteResult.portalUrl}</code>
                    <button onClick={copyPortalLink} className="inline-flex items-center gap-1 rounded bg-gray-900 px-2 py-1 text-[11px] text-white">
                      <Link2 className="h-3 w-3" /> Copiar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {highRiskItems > 0 ? (
            <p className="text-xs text-red-500">{highRiskItems} item(ns) críticos exigem ação hoje.</p>
          ) : null}
        </>
      )}
    </div>
  )
}
