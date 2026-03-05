'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useConfirm } from '@/hooks/use-confirm'
import { useCrudMutations } from '@/hooks/use-crud-mutations'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { toast } from '@/hooks/use-toast'
import { track } from '@/lib/analytics/client'
import { fmt, fmtDate } from '@/lib/utils'
import { createTransacaoSchema, type CreateTransacaoDTO } from '@/shared/schemas/business'
import type {
  ReceiptReviewPayload,
  TransacaoAttachmentSummary,
  TransacaoReceiptIntakeSummary,
} from '@/shared/types/transacao-receipts'
import {
  FileText,
  Hash,
  ImageIcon,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import type { Transacao, Obra } from '@/types/database'
import {
  EmptyStateAction,
  PageHeader,
  PaginationControls,
  QuickActionBar,
  SectionCard,
  VirtualizedList,
} from '@/components/ui/enterprise'
import { MobileShellV1 } from '@/platform/ui/mobile-shell-v1'
import { FormField, FormInput, FormSelect, FormTextarea } from '@/components/ui/form-field'

const LazyBarChart = dynamic(
  () =>
    import('@/components/ui/enterprise/lazy-bar-chart').then(
      (module) => module.LazyBarChart
    ),
  {
    ssr: false,
    loading: () => <div className="skeleton h-[240px] w-full rounded-xl" />,
  }
)

interface Props {
  initialTransacoes: Transacao[]
  receiptsEnabled?: boolean
  receiptAiEnabled?: boolean
}
interface OrcadoVsRealizadoSummary {
  summary: Array<{
    obraId: string
    nome: string
    valorOrcado: number
    valorRealizado: number
    desvio: number
    desvioPct: number
    isCritical: boolean
  }>
  totals: {
    totalObras: number
    totalCritical: number
  }
}

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

const PAGE_SIZE = 50
const RECEIPT_PREFILL_CONFIDENCE = 0.75

function formatConfidence(confidence: number | null): string {
  if (confidence === null) return 'sem score'
  return `${Math.round(confidence * 100)}%`
}

function shouldAutofill(confidence: number | null): boolean {
  return typeof confidence === 'number' && confidence >= RECEIPT_PREFILL_CONFIDENCE
}

function isReceiptImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function FinanceiroContent({
  initialTransacoes,
  receiptsEnabled: receiptsEnabledProp,
  receiptAiEnabled: receiptAiEnabledProp,
}: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Financeiro
  const usePaginationV1 = featureFlags.uiPaginationV1
  const receiptsEnabled = receiptsEnabledProp ?? featureFlags.financeReceiptsV1
  const receiptAiEnabled =
    receiptAiEnabledProp ?? (featureFlags.financeReceiptsV1 && featureFlags.financeReceiptAiV1)
  const [transacoes, setTransacoes] = useState(initialTransacoes)
  const [pagination, setPagination] = useState<PaginationMeta>({
    count: initialTransacoes.length,
    page: 1,
    pageSize: PAGE_SIZE,
    total: initialTransacoes.length,
    hasMore: false,
  })
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingTx, setEditingTx] = useState<Transacao | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'Todos' | 'Receita' | 'Despesa'>('Todos')
  const [busca, setBusca] = useState('')
  const [obras, setObras] = useState<Pick<Obra, 'id' | 'nome'>[]>([])
  const [desvioResumo, setDesvioResumo] = useState<OrcadoVsRealizadoSummary | null>(null)
  const [desvioLoading, setDesvioLoading] = useState(true)
  const [desvioError, setDesvioError] = useState<string | null>(null)
  const [receiptIntake, setReceiptIntake] = useState<TransacaoReceiptIntakeSummary | null>(null)
  const [receiptUploading, setReceiptUploading] = useState(false)
  const [receiptDragActive, setReceiptDragActive] = useState(false)
  const [attachments, setAttachments] = useState<TransacaoAttachmentSummary[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)

  const defaultValues: CreateTransacaoDTO = {
    descricao: '',
    tipo: 'Receita',
    categoria: '',
    valor: 0,
    data: new Date().toISOString().slice(0, 10),
    status: 'Confirmado',
    forma_pagto: null,
    notas: null,
    obra_id: null,
    receipt_intake_id: null,
  }

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CreateTransacaoDTO>({
    resolver: zodResolver(createTransacaoSchema) as never,
    defaultValues,
  })

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<Transacao>({
    setItems: setTransacoes,
    basePath: '/api/v1/transacoes',
    entityName: 'Transação',
    trackSource: 'web',
    trackEntityType: 'transacao',
    onSettled: () => refreshTransacoes?.(pagination.page),
  })

  useEffect(() => {
    async function loadObras() {
      try {
        const data = await apiRequest<Pick<Obra, 'id' | 'nome'>[]>('/api/v1/obras?limit=100')
        setObras(data)
      } catch {
        setObras([])
      }
    }
    loadObras()
  }, [])

  async function refreshTransacoes(targetPage = 1) {
    if (!usePaginationV1) {
      return
    }
    setIsPageLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      })
      if (filtroTipo !== 'Todos') {
        params.set('tipo', filtroTipo)
      }
      const payload = await apiRequestWithMeta<Transacao[], PaginationMeta>(`/api/v1/transacoes?${params.toString()}`)
      setTransacoes(payload.data)
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
      const message = err instanceof Error ? err.message : 'Erro ao recarregar transações'
      setLoadError(message)
      toast(message, 'error')
    } finally {
      setIsPageLoading(false)
    }
  }

  const loadDesvio = useCallback(async () => {
    setDesvioLoading(true)
    setDesvioError(null)
    try {
      const data = await apiRequest<OrcadoVsRealizadoSummary>('/api/v1/transacoes/orcado-vs-realizado?thresholdPct=10')
      setDesvioResumo(data)
    } catch (err) {
      setDesvioResumo(null)
      setDesvioError(err instanceof Error ? err.message : 'Erro ao carregar desvio orçado x realizado')
    } finally {
      setDesvioLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDesvio()
  }, [loadDesvio])

  useEffect(() => {
    if (!usePaginationV1) return
    void refreshTransacoes(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePaginationV1, filtroTipo])

  async function loadAttachments(transacaoId: string) {
    if (!receiptsEnabled) return
    setAttachmentsLoading(true)
    try {
      const payload = await apiRequest<{ items: TransacaoAttachmentSummary[] }>(
        `/api/v1/transacoes/${transacaoId}/anexos`
      )
      setAttachments(payload.items || [])
    } catch (error) {
      setAttachments([])
      toast(error instanceof Error ? error.message : 'Erro ao carregar anexos', 'error')
    } finally {
      setAttachmentsLoading(false)
    }
  }

  function applyReceiptSuggestions(reviewPayload: ReceiptReviewPayload | null) {
    if (!reviewPayload || reviewPayload.status !== 'ready_for_review') return

    const currentValues = getValues()
    if (
      reviewPayload.descricao.value &&
      shouldAutofill(reviewPayload.descricao.confidence) &&
      !currentValues.descricao
    ) {
      setValue('descricao', reviewPayload.descricao.value, { shouldDirty: true })
    }
    if (
      reviewPayload.categoria.value &&
      shouldAutofill(reviewPayload.categoria.confidence) &&
      !currentValues.categoria
    ) {
      setValue('categoria', reviewPayload.categoria.value, { shouldDirty: true })
    }
    if (
      typeof reviewPayload.valor_total.value === 'number' &&
      shouldAutofill(reviewPayload.valor_total.confidence) &&
      !currentValues.valor
    ) {
      setValue('valor', reviewPayload.valor_total.value, { shouldDirty: true })
    }
    if (
      reviewPayload.data_emissao.value &&
      shouldAutofill(reviewPayload.data_emissao.confidence) &&
      !currentValues.data
    ) {
      setValue('data', reviewPayload.data_emissao.value, { shouldDirty: true })
    }
    if (
      reviewPayload.forma_pagamento.value &&
      shouldAutofill(reviewPayload.forma_pagamento.confidence) &&
      !currentValues.forma_pagto
    ) {
      setValue('forma_pagto', reviewPayload.forma_pagamento.value, { shouldDirty: true })
    }
    if (
      reviewPayload.fornecedor.value &&
      shouldAutofill(reviewPayload.fornecedor.confidence)
    ) {
      const currentNotes = currentValues.notas || ''
      if (!currentNotes.includes(reviewPayload.fornecedor.value)) {
        const nextNotes = [currentNotes.trim(), `Fornecedor sugerido: ${reviewPayload.fornecedor.value}`]
          .filter(Boolean)
          .join('\n')
        setValue('notas', nextNotes, { shouldDirty: true })
      }
    }
  }

  async function uploadReceipt(file: File) {
    if (!receiptsEnabled) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('run_ai', String(receiptAiEnabled))

    setReceiptUploading(true)
    try {
      const intake = await apiRequest<TransacaoReceiptIntakeSummary>(
        '/api/v1/transacoes/receipts/intake',
        {
          method: 'POST',
          body: formData,
        }
      )

      setReceiptIntake(intake)
      track('receipt_uploaded', {
        source: 'web',
        entity_type: 'transacao_receipt',
        entity_id: intake.id,
        outcome: 'success',
        mime_type: intake.mime_type,
      }).catch(() => undefined)

      if (intake.review_payload?.status === 'ready_for_review') {
        track('receipt_ai_extracted', {
          source: 'web',
          entity_type: 'transacao_receipt',
          entity_id: intake.id,
          outcome: 'success',
        }).catch(() => undefined)
      }

      applyReceiptSuggestions(intake.review_payload)

      if (editingTx) {
        await apiRequest(`/api/v1/transacoes/${editingTx.id}/anexos`, {
          method: 'POST',
          body: {
            receipt_intake_id: intake.id,
          },
        })
        await loadAttachments(editingTx.id)
      }

      toast('Recibo enviado com sucesso', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao enviar recibo', 'error')
    } finally {
      setReceiptUploading(false)
      setReceiptDragActive(false)
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!editingTx) return
    const accepted = await confirm({
      title: 'Excluir anexo?',
      description: 'O arquivo será removido do storage privado desta transação.',
      confirmLabel: 'Excluir anexo',
      variant: 'danger',
    })
    if (!accepted) return

    try {
      await apiRequest(`/api/v1/transacoes/${editingTx.id}/anexos/${attachmentId}`, {
        method: 'DELETE',
      })
      await loadAttachments(editingTx.id)
      toast('Anexo removido', 'info')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao remover anexo', 'error')
    }
  }

  async function handleReceiptFiles(files: FileList | File[] | null) {
    const file = files?.[0]
    if (!file) return
    await uploadReceipt(file)
  }

  const receitas = transacoes.filter((t) => t.tipo === 'Receita').reduce((s, t) => s + t.valor, 0)
  const despesas = transacoes.filter((t) => t.tipo === 'Despesa').reduce((s, t) => s + t.valor, 0)
  const saldo = receitas - despesas

  const filtered = useMemo(() => {
    return transacoes.filter((t) => {
      if (filtroTipo !== 'Todos' && t.tipo !== filtroTipo) return false
      if (busca && !t.descricao.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
  }, [transacoes, filtroTipo, busca])
  const useTableVirtualization =
    featureFlags.tableVirtualization && usePaginationV1 && filtered.length > 25

  // Chart data — last 6 months
  const chartData = useMemo(() => {
    const now = new Date()
    const months: { key: string; label: string; rec: number; dep: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      months.push({ key, label, rec: 0, dep: 0 })
    }
    for (const t of transacoes) {
      const key = t.data.slice(0, 7)
      const m = months.find((x) => x.key === key)
      if (m) {
        if (t.tipo === 'Receita') m.rec += t.valor
        else m.dep += t.valor
      }
    }
    return {
      labels: months.map((m) => m.label),
      datasets: [
        { label: 'Receitas', data: months.map((m) => m.rec / 1000), backgroundColor: 'rgba(52,211,153,.7)', borderRadius: 6 },
        { label: 'Despesas', data: months.map((m) => m.dep / 1000), backgroundColor: 'rgba(251,113,133,.7)', borderRadius: 6 },
      ],
    }
  }, [transacoes])

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const, labels: { usePointStyle: true, pointStyleWidth: 8, padding: 16, font: { size: 11 } } },
      tooltip: { callbacks: { label: (ctx: { dataset: { label: string }; parsed: { y: number } }) => `${ctx.dataset.label}: R$${ctx.parsed.y.toFixed(1)}k` } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { callback: (v: number | string) => `R$${v}k`, font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  }

  function openEditTx(tx: Transacao) {
    setEditingTx(tx)
    setReceiptIntake(null)
    reset({
      descricao: tx.descricao,
      tipo: tx.tipo,
      categoria: tx.categoria,
      valor: tx.valor,
      data: tx.data,
      status: tx.status,
      forma_pagto: tx.forma_pagto || null,
      notas: tx.notas || null,
      obra_id: tx.obra_id || null,
      receipt_intake_id: null,
    })
    setShowForm(true)
    void loadAttachments(tx.id)
  }

  function closeForm() {
    setShowForm(false)
    setEditingTx(null)
    setReceiptIntake(null)
    setAttachments([])
    setReceiptDragActive(false)
    reset(defaultValues)
  }

  function openCreateTxForm() {
    closeForm()
    setShowForm(true)
  }

  async function onSubmit(data: CreateTransacaoDTO) {
    const payload = {
      ...data,
      obra_id: data.obra_id || null,
      receipt_intake_id: editingTx ? null : receiptIntake?.id || null,
    }

    let ok: boolean
    if (editingTx) {
      ok = await updateMutation.mutate(payload, editingTx.id)
    } else {
      ok = await createMutation.mutate(payload)
    }

    if (ok) {
      if (receiptIntake?.review_payload?.status === 'ready_for_review') {
        track('receipt_ai_confirmed', {
          source: 'web',
          entity_type: 'transacao_receipt',
          entity_id: receiptIntake.id,
          outcome: 'success',
        }).catch(() => undefined)
      }
      await loadDesvio()
      closeForm()
    }
  }

  async function deleteTx(id: string) {
    const ok = await confirm({ title: 'Excluir transação?', description: 'Essa ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' })
    if (!ok) return

    const success = await deleteMutation.mutate(undefined, id)
    if (success) {
      await loadDesvio()
    }
  }

  function renderTransactionRow(t: Transacao) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 transition-all group">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.tipo === 'Receita' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            <div className={`w-3 h-3 rounded-full ${t.tipo === 'Receita' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.descricao}</p>
            <p className="text-xs text-gray-400">{fmtDate(t.data)} · {t.categoria}{t.obras?.nome ? ` · ${t.obras.nome}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm ${t.tipo === 'Receita' ? 'text-emerald-600' : 'text-red-500'}`}>
            {t.tipo === 'Receita' ? '+' : '-'}{fmt(t.valor)}
          </span>
          <button onClick={() => openEditTx(t)} className="md:opacity-0 md:group-hover:opacity-100 p-1 text-gray-400 hover:text-sand-600 transition-all">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => deleteTx(t.id)} className="md:opacity-0 md:group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  if (!isPageLoading && transacoes.length === 0) {
    return (
      <MobileShellV1
        primaryAction={
          <button
            type="button"
            onClick={openCreateTxForm}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sand-600"
          >
            <Plus className="h-4 w-4" />
            Nova Transação
          </button>
        }
      >
        <div className="tailadmin-page">
          <EmptyStateAction
            icon={<Wallet className="h-5 w-5 text-sand-600" />}
            title="Nenhuma transação registrada"
            description="Registre receitas e despesas para acompanhar o fluxo de caixa em tempo real."
            actionLabel="Nova Transação"
            onAction={openCreateTxForm}
          />
        </div>
      </MobileShellV1>
    )
  }

  return (
    <MobileShellV1
      primaryAction={
        <button
          type="button"
          onClick={openCreateTxForm}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sand-600"
        >
          <Plus className="h-4 w-4" />
          Nova Transação
        </button>
      }
    >
      <div className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} space-y-5`}>
        <PageHeader
          title="Financeiro"
          subtitle={`${pagination.total || transacoes.length} transações`}
          actions={
            <QuickActionBar
              actions={[{
                label: 'Nova Transação',
                icon: <Plus className="h-4 w-4" />,
                onClick: openCreateTxForm,
                tone: 'warning',
              }]}
            />
          }
        />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg"><TrendingUp className="w-4 h-4 text-emerald-600" /></div></div>
          <p className="text-lg font-semibold text-emerald-600">{fmt(receitas)}</p>
          <p className="text-xs text-gray-500">{usePaginationV1 ? 'Receitas (página)' : 'Total Receitas'}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-red-100 dark:bg-red-900/20 rounded-lg"><TrendingDown className="w-4 h-4 text-red-500" /></div></div>
          <p className="text-lg font-semibold text-red-500">{fmt(despesas)}</p>
          <p className="text-xs text-gray-500">{usePaginationV1 ? 'Despesas (página)' : 'Total Despesas'}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-sand-100 dark:bg-sand-900/20 rounded-lg"><Wallet className="w-4 h-4 text-sand-600" /></div></div>
          <p className={`text-lg font-semibold ${saldo >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(saldo)}</p>
          <p className="text-xs text-gray-500">{usePaginationV1 ? 'Saldo (página)' : 'Saldo Líquido'}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2"><div className="p-1.5 bg-purple-100 dark:bg-purple-900/20 rounded-lg"><Hash className="w-4 h-4 text-purple-600" /></div></div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{usePaginationV1 ? pagination.total : transacoes.length}</p>
          <p className="text-xs text-gray-500">{usePaginationV1 ? 'Transações (total)' : 'Transações'}</p>
        </div>
      </div>

      {/* Chart */}
      <SectionCard className="p-4 md:p-5">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Receitas vs Despesas (últimos 6 meses)</h3>
        <div className="h-[240px]">
          <LazyBarChart data={chartData} options={chartOpts as never} />
        </div>
      </SectionCard>

      {desvioLoading ? (
        <div className="skeleton h-[140px] w-full rounded-2xl" />
      ) : desvioError ? (
        <SectionCard className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-600 dark:text-red-400">{desvioError}</p>
            <button
              type="button"
              onClick={() => void loadDesvio()}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Tentar novamente
            </button>
          </div>
        </SectionCard>
      ) : desvioResumo ? (
        <div className="glass-card rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Desvio Orçado x Realizado</h3>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              desvioResumo.totals.totalCritical > 0
                ? 'bg-red-100 text-red-600'
                : 'bg-emerald-100 text-emerald-600'
            }`}>
              {desvioResumo.totals.totalCritical} críticas
            </span>
          </div>
          {desvioResumo.summary.slice(0, 3).map((obra) => (
            <div key={obra.obraId} className="flex items-center justify-between py-2 border-b last:border-0 border-gray-200/60 dark:border-gray-700/60">
              <div>
                <p className="text-sm text-gray-900 dark:text-white">{obra.nome}</p>
                <p className="text-xs text-gray-500">Orçado {fmt(obra.valorOrcado)} · Realizado {fmt(obra.valorRealizado)}</p>
              </div>
              <span className={`text-sm font-semibold ${obra.isCritical ? 'text-red-500' : 'text-emerald-600'}`}>
                {obra.desvioPct >= 0 ? '+' : ''}{obra.desvioPct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Filters */}
      <SectionCard className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descrição..." className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
          <div className="flex gap-1">
            {(['Todos', 'Receita', 'Despesa'] as const).map((t) => (
              <button key={t} onClick={() => setFiltroTipo(t)} className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${filtroTipo === t ? 'bg-sand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Transaction List */}
      <SectionCard className="space-y-1.5 p-3">
        {loadError ? (
          <div className="py-6 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <button
              type="button"
              onClick={() => void refreshTransacoes(pagination.page || 1)}
              className="mt-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Tentar novamente
            </button>
          </div>
        ) : isPageLoading && filtered.length === 0 ? (
          <div className="space-y-2 py-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Nenhuma transação encontrada</p>
        ) : useTableVirtualization ? (
          <VirtualizedList
            items={filtered}
            rowHeight={68}
            containerHeight={420}
            getKey={(item) => item.id}
            renderItem={(item) => renderTransactionRow(item)}
            className="rounded-xl border border-gray-200/70 p-1 dark:border-gray-800"
          />
        ) : (
          filtered.map((t) => (
            <div key={t.id}>
              {renderTransactionRow(t)}
            </div>
          ))
        )}
        {usePaginationV1 ? (
          <PaginationControls
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            hasMore={pagination.hasMore}
            isLoading={isPageLoading}
            onPrev={() => void refreshTransacoes(Math.max(1, pagination.page - 1))}
            onNext={() => void refreshTransacoes(pagination.page + 1)}
          />
        ) : null}
      </SectionCard>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl dark:bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editingTx ? 'Editar Transação' : 'Nova Transação'}</h3>
              <button onClick={closeForm} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <FormField label="Descrição" error={errors.descricao} required>
                <FormInput
                  registration={register('descricao')}
                  hasError={!!errors.descricao}
                  placeholder="Descrição"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Tipo" error={errors.tipo} required>
                  <FormSelect registration={register('tipo')} hasError={!!errors.tipo}>
                    <option value="Receita">Receita</option>
                    <option value="Despesa">Despesa</option>
                  </FormSelect>
                </FormField>
                <FormField label="Categoria" error={errors.categoria} required>
                  <FormInput
                    registration={register('categoria')}
                    hasError={!!errors.categoria}
                    placeholder="Categoria"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Valor (R$)" error={errors.valor} required>
                  <FormInput
                    registration={register('valor', { valueAsNumber: true })}
                    hasError={!!errors.valor}
                    placeholder="0,00"
                    type="number"
                    step="0.01"
                  />
                </FormField>
                <FormField label="Data" error={errors.data} required>
                  <FormInput
                    registration={register('data')}
                    hasError={!!errors.data}
                    type="date"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Status" error={errors.status}>
                  <FormSelect registration={register('status')} hasError={!!errors.status}>
                    <option value="Confirmado">Confirmado</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Cancelado">Cancelado</option>
                  </FormSelect>
                </FormField>
                <FormField label="Forma de Pagamento" error={errors.forma_pagto}>
                  <FormInput
                    registration={register('forma_pagto')}
                    hasError={!!errors.forma_pagto}
                    placeholder="Ex: PIX, Boleto"
                  />
                </FormField>
              </div>
              <FormField label="Obra" error={errors.obra_id}>
                <FormSelect registration={register('obra_id')} hasError={!!errors.obra_id}>
                  <option value="">Obra (opcional)</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="Notas" error={errors.notas}>
                <FormTextarea
                  registration={register('notas')}
                  hasError={!!errors.notas}
                  placeholder="Observações (opcional)"
                  rows={2}
                />
              </FormField>
              {receiptsEnabled ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-950/40">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-sand-600" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          Recibo ou nota fiscal
                        </h4>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {editingTx
                          ? 'Anexe novos comprovantes à transação existente.'
                          : 'Envie um comprovante para pré-preencher os campos com revisão manual obrigatória.'}
                      </p>
                    </div>
                    {receiptUploading ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-1 text-[11px] font-semibold text-sand-700 dark:bg-sand-900/30 dark:text-sand-300">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processando
                      </span>
                    ) : null}
                  </div>

                  <label
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center transition-all ${
                      receiptDragActive
                        ? 'border-sand-500 bg-sand-50 dark:bg-sand-900/20'
                        : 'border-gray-300 bg-white hover:border-sand-400 hover:bg-sand-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-sand-500'
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setReceiptDragActive(true)
                    }}
                    onDragLeave={() => setReceiptDragActive(false)}
                    onDrop={(event) => {
                      event.preventDefault()
                      setReceiptDragActive(false)
                      void handleReceiptFiles(Array.from(event.dataTransfer.files || []))
                    }}
                  >
                    <Sparkles className="mb-2 h-5 w-5 text-sand-600" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Arraste JPG, PNG, WEBP ou PDF aqui
                    </span>
                    <span className="mt-1 text-xs text-gray-500">
                      ou clique para selecionar um arquivo de at\u00e9 15 MB
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      disabled={receiptUploading}
                      onChange={(event) => void handleReceiptFiles(event.target.files)}
                    />
                  </label>

                  {receiptIntake ? (
                    <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
                          {receiptIntake.signed_url && isReceiptImage(receiptIntake.mime_type) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={receiptIntake.signed_url}
                              alt="Preview do recibo"
                              className="h-full w-full object-cover"
                            />
                          ) : receiptIntake.mime_type === 'application/pdf' ? (
                            <FileText className="h-6 w-6 text-red-500" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-sand-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {receiptIntake.original_filename}
                            </p>
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                              {receiptIntake.mime_type}
                            </span>
                            <span className="rounded-full bg-sand-100 px-2 py-1 text-[11px] font-medium text-sand-700 dark:bg-sand-900/30 dark:text-sand-300">
                              {receiptIntake.review_payload?.status === 'ready_for_review'
                                ? 'Sugestões prontas'
                                : receiptIntake.review_payload?.status === 'failed'
                                  ? 'IA indisponível'
                                  : 'Manual'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {(receiptIntake.size_bytes / 1024 / 1024).toFixed(2)} MB
                            {receiptIntake.signed_url ? ' · preview seguro ativo' : ''}
                          </p>
                          {receiptIntake.review_payload?.error_message ? (
                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                              {receiptIntake.review_payload.error_message}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {receiptIntake.review_payload ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          {[
                            ['Fornecedor', receiptIntake.review_payload.fornecedor.value, receiptIntake.review_payload.fornecedor.confidence],
                            ['Descrição', receiptIntake.review_payload.descricao.value, receiptIntake.review_payload.descricao.confidence],
                            [
                              'Valor',
                              typeof receiptIntake.review_payload.valor_total.value === 'number'
                                ? fmt(receiptIntake.review_payload.valor_total.value)
                                : null,
                              receiptIntake.review_payload.valor_total.confidence,
                            ],
                            ['Data', receiptIntake.review_payload.data_emissao.value, receiptIntake.review_payload.data_emissao.confidence],
                            ['Categoria', receiptIntake.review_payload.categoria.value, receiptIntake.review_payload.categoria.confidence],
                            ['Pagamento', receiptIntake.review_payload.forma_pagamento.value, receiptIntake.review_payload.forma_pagamento.confidence],
                          ].map(([label, value, confidence]) => (
                            <div
                              key={String(label)}
                              className="rounded-xl border border-gray-200 px-3 py-2 text-xs dark:border-gray-800"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-gray-700 dark:text-gray-200">
                                  {label}
                                </span>
                                <span className="text-[10px] uppercase tracking-wide text-gray-400">
                                  {formatConfidence(typeof confidence === 'number' ? confidence : null)}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                {typeof value === 'string' || typeof value === 'number'
                                  ? String(value)
                                  : '\u2014'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-gray-500">
                      Nenhum recibo anexado nesta sess\u00e3o.
                    </p>
                  )}

                  {editingTx ? (
                    <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          Anexos da transação
                        </p>
                        {attachmentsLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        ) : null}
                      </div>
                      {attachments.length === 0 ? (
                        <p className="text-xs text-gray-500">Nenhum anexo vinculado ainda.</p>
                      ) : (
                        <div className="space-y-2">
                          {attachments.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                  {attachment.original_filename}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {fmtDate(attachment.created_at)} · {attachment.mime_type}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {attachment.signed_url ? (
                                  <a
                                    href={attachment.signed_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                                  >
                                    Abrir
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void deleteAttachment(attachment.id)}
                                  className="rounded-lg p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeForm} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button
                  type="submit"
                  disabled={createMutation.isMutating || updateMutation.isMutating || receiptUploading}
                  className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm disabled:opacity-50"
                >
                  {(createMutation.isMutating || updateMutation.isMutating) ? 'Salvando...' : editingTx ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        {confirmDialog}
      </div>
    </MobileShellV1>
  )
}
