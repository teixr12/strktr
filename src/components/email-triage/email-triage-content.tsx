'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Mail, Plus, RefreshCcw, ShieldCheck, Trash2, Pencil, X } from 'lucide-react'
import { useConfirm } from '@/hooks/use-confirm'
import { useCrudMutations } from '@/hooks/use-crud-mutations'
import { useToast } from '@/hooks/use-toast'
import { apiRequestWithMeta } from '@/lib/api/client'
import { createEmailTriageItemSchema, type CreateEmailTriageItemDTO } from '@/shared/schemas/email-triage'
import type {
  EmailTriageClassification,
  EmailTriageLeadOption,
  EmailTriageRecord,
  EmailTriageStatus,
  EmailTriageSummary,
} from '@/shared/types/email-triage'
import { EmptyStateAction, PageHeader, PaginationControls, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import { FormField, FormInput, FormSelect, FormTextarea } from '@/components/ui/form-field'

interface Props {
  initialItems: EmailTriageRecord[]
  initialSummary: EmailTriageSummary
  initialLeads: EmailTriageLeadOption[]
}

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  summary?: EmailTriageSummary
}

const PAGE_SIZE = 50

const CLASSIFICATION_OPTIONS: Array<{ value: EmailTriageClassification; label: string }> = [
  { value: 'unknown', label: 'Indefinido' },
  { value: 'lead', label: 'Lead' },
  { value: 'supplier', label: 'Fornecedor' },
  { value: 'client', label: 'Cliente' },
  { value: 'operations', label: 'Operacional' },
  { value: 'spam', label: 'Spam' },
]

const STATUS_OPTIONS: Array<{ value: EmailTriageStatus; label: string }> = [
  { value: 'new', label: 'Novo' },
  { value: 'reviewing', label: 'Em revisão' },
  { value: 'qualified', label: 'Qualificado' },
  { value: 'ignored', label: 'Ignorado' },
  { value: 'archived', label: 'Arquivado' },
]

function classificationLabel(value: EmailTriageClassification) {
  return CLASSIFICATION_OPTIONS.find((item) => item.value === value)?.label || value
}

function statusLabel(value: EmailTriageStatus) {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label || value
}

function classificationTone(value: EmailTriageClassification) {
  if (value === 'lead') return 'bg-emerald-100 text-emerald-700'
  if (value === 'supplier') return 'bg-blue-100 text-blue-700'
  if (value === 'spam') return 'bg-red-100 text-red-700'
  if (value === 'operations') return 'bg-sand-100 text-sand-700'
  return 'bg-gray-100 text-gray-600'
}

function statusTone(value: EmailTriageStatus) {
  if (value === 'qualified') return 'bg-emerald-100 text-emerald-700'
  if (value === 'ignored' || value === 'archived') return 'bg-gray-100 text-gray-600'
  if (value === 'reviewing') return 'bg-amber-100 text-amber-700'
  return 'bg-blue-100 text-blue-700'
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDatetimeLocalValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function toIsoDatetime(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function EmailTriageContent({ initialItems, initialSummary, initialLeads }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const toast = useToast()
  const [items, setItems] = useState(initialItems)
  const [summary, setSummary] = useState(initialSummary)
  const [pagination, setPagination] = useState<PaginationMeta>({
    count: initialItems.length,
    page: 1,
    pageSize: PAGE_SIZE,
    total: initialItems.length,
    hasMore: false,
    summary: initialSummary,
  })
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [classificationFilter, setClassificationFilter] = useState<'all' | EmailTriageClassification>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | EmailTriageStatus>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<EmailTriageRecord | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEmailTriageItemDTO>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod resolver generic mismatch
    resolver: zodResolver(createEmailTriageItemSchema) as any,
    defaultValues: {
      source: 'manual',
      sender_name: '',
      sender_email: '',
      subject: '',
      snippet: '',
      classification: 'unknown',
      status: 'new',
      lead_id: '',
      received_at: toDatetimeLocalValue(new Date().toISOString()),
      notes: '',
    },
  })

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<EmailTriageRecord>({
    setItems,
    basePath: '/api/v1/email-ingest',
    entityName: 'Email triado',
    trackSource: 'web',
    trackEntityType: 'email_triage_item',
    onSettled: () => void refresh(pagination.page || 1),
  })

  const priorityList = useMemo(
    () => items.filter((item) => item.status === 'new' || item.status === 'reviewing').slice(0, 3),
    [items]
  )

  async function refresh(targetPage = 1) {
    setIsPageLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      })
      if (classificationFilter !== 'all') params.set('classification', classificationFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search.trim()) params.set('q', search.trim())

      const payload = await apiRequestWithMeta<EmailTriageRecord[], PaginationMeta>(`/api/v1/email-ingest?${params.toString()}`)
      setItems(payload.data)
      setPagination(
        payload.meta || {
          count: payload.data.length,
          page: targetPage,
          pageSize: PAGE_SIZE,
          total: payload.data.length,
          hasMore: false,
        }
      )
      setSummary(payload.meta?.summary || initialSummary)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar inbox de triagem'
      setLoadError(message)
      toast(message, 'error')
    } finally {
      setIsPageLoading(false)
    }
  }

  useEffect(() => {
    void refresh(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classificationFilter, statusFilter])

  function openForm(item?: EmailTriageRecord) {
    if (item) {
      setEditing(item)
      reset({
        source: item.source,
        sender_name: item.sender_name || '',
        sender_email: item.sender_email,
        subject: item.subject,
        snippet: item.snippet || '',
        classification: item.classification,
        status: item.status,
        lead_id: item.lead_id || '',
        received_at: toDatetimeLocalValue(item.received_at),
        notes: item.notes || '',
      })
    } else {
      setEditing(null)
      reset({
        source: 'manual',
        sender_name: '',
        sender_email: '',
        subject: '',
        snippet: '',
        classification: 'unknown',
        status: 'new',
        lead_id: '',
        received_at: toDatetimeLocalValue(new Date().toISOString()),
        notes: '',
      })
    }
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  async function onSubmit(data: CreateEmailTriageItemDTO) {
    const payload = {
      source: data.source,
      sender_name: data.sender_name || null,
      sender_email: data.sender_email,
      subject: data.subject,
      snippet: data.snippet || null,
      classification: data.classification,
      status: data.status,
      lead_id: data.lead_id || null,
      received_at: toIsoDatetime(data.received_at),
      notes: data.notes || null,
    }

    const done = editing ? await updateMutation.mutate(payload, editing.id) : await createMutation.mutate(payload)
    if (done) closeForm()
  }

  async function removeItem(id: string) {
    const accepted = await confirm({
      title: 'Excluir email triado?',
      description: 'Essa ação remove o registro persistido da fila de triagem.',
      confirmLabel: 'Excluir',
      variant: 'danger',
    })
    if (!accepted) return
    await deleteMutation.mutate(undefined, id)
  }

  if (!isPageLoading && items.length === 0 && !showForm) {
    return (
      <div className="tailadmin-page space-y-4" aria-busy={isPageLoading}>
        <PageHeader
          title="Email Triage"
          subtitle="Ingestão e classificação operacional de emails de entrada"
          actions={
            <QuickActionBar
              actions={[
                {
                  label: 'Novo Email',
                  icon: <Plus className="h-4 w-4" />,
                  onClick: () => openForm(),
                  tone: 'warning',
                },
              ]}
            />
          }
        />
        <EmptyStateAction
          icon={<Mail className="h-5 w-5 text-sand-600" />}
          title="Nenhum email em triagem"
          description="Registre emails relevantes para classificar leads, fornecedores, clientes ou spam de forma persistida e auditável."
          actionLabel="Novo Email"
          onAction={() => openForm()}
        />
        {showForm ? null : confirmDialog}
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isPageLoading}>
      <PageHeader
        title="Email Triage"
        subtitle={`${pagination.total || items.length} emails registrados`}
        actions={
          <QuickActionBar
            actions={[
              {
                label: 'Atualizar',
                icon: <RefreshCcw className="h-4 w-4" />,
                onClick: () => void refresh(pagination.page || 1),
              },
              {
                label: 'Novo Email',
                icon: <Plus className="h-4 w-4" />,
                onClick: () => openForm(),
                tone: 'warning',
              },
            ]}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard density="compact" title="Sem revisão" subtitle="Novos ou em revisão">
          <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{summary.unreviewed}</p>
        </SectionCard>
        <SectionCard density="compact" title="Leads" subtitle="Classificados como lead">
          <p className="text-3xl font-semibold text-emerald-600">{summary.leadCandidates}</p>
        </SectionCard>
        <SectionCard density="compact" title="Fornecedores" subtitle="Classificados como supplier">
          <p className="text-3xl font-semibold text-blue-600">{summary.supplierCandidates}</p>
        </SectionCard>
        <SectionCard density="compact" title="Spam" subtitle="Descartes operacionais">
          <p className="text-3xl font-semibold text-red-600">{summary.spam}</p>
        </SectionCard>
      </div>

      {priorityList.length > 0 ? (
        <SectionCard title="O que revisar agora" subtitle="Fila prioritária de emails ainda não triados" density="compact" surface="soft">
          <div className="grid gap-3 md:grid-cols-3">
            {priorityList.map((item) => (
              <div key={item.id} className="rounded-xl border border-sand-200 bg-white/80 p-3 dark:border-sand-900/40 dark:bg-gray-950/60">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.subject}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.sender_name || item.sender_email}</p>
                <p className="mt-2 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">{item.snippet || 'Sem resumo capturado'}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {showForm ? (
        <SectionCard
          title={editing ? 'Editar email triado' : 'Novo email triado'}
          subtitle="Persistido no backend, com classificação e vínculo opcional a lead"
          right={
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
            </button>
          }
        >
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <FormField label="Remetente" error={errors.sender_name}>
              <FormInput registration={register('sender_name')} hasError={!!errors.sender_name} placeholder="Nome do remetente" />
            </FormField>
            <FormField label="Email do remetente" required error={errors.sender_email}>
              <FormInput type="email" registration={register('sender_email')} hasError={!!errors.sender_email} placeholder="contato@empresa.com" />
            </FormField>
            <FormField label="Assunto" required error={errors.subject} className="md:col-span-2">
              <FormInput registration={register('subject')} hasError={!!errors.subject} placeholder="Assunto do email" />
            </FormField>
            <FormField label="Classificação" error={errors.classification}>
              <FormSelect registration={register('classification')} hasError={!!errors.classification}>
                {CLASSIFICATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Status" error={errors.status}>
              <FormSelect registration={register('status')} hasError={!!errors.status}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Lead vinculado" error={errors.lead_id}>
              <FormSelect registration={register('lead_id')} hasError={!!errors.lead_id}>
                <option value="">Sem vínculo</option>
                {initialLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>{lead.nome}</option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Recebido em" error={errors.received_at}>
              <FormInput type="datetime-local" registration={register('received_at')} hasError={!!errors.received_at} />
            </FormField>
            <FormField label="Resumo / snippet" error={errors.snippet} className="md:col-span-2">
              <FormTextarea rows={3} registration={register('snippet')} hasError={!!errors.snippet} placeholder="Trecho relevante do email" />
            </FormField>
            <FormField label="Notas internas" error={errors.notes} className="md:col-span-2">
              <FormTextarea rows={4} registration={register('notes')} hasError={!!errors.notes} placeholder="Motivo da classificação, próximo passo, vínculo comercial..." />
            </FormField>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={createMutation.isMutating || updateMutation.isMutating}
                className="rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
              >
                {createMutation.isMutating || updateMutation.isMutating ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar email'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Filtro de triagem" subtitle="Filtre por classificação, status e remetente" density="compact">
        <div className="grid gap-3 md:grid-cols-3">
          <FormField label="Buscar">
            <FormInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Assunto, remetente, snippet" />
          </FormField>
          <FormField label="Classificação">
            <FormSelect value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value as 'all' | EmailTriageClassification)}>
              <option value="all">Todas</option>
              {CLASSIFICATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Status">
            <FormSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | EmailTriageStatus)}>
              <option value="all">Todos</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FormSelect>
          </FormField>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh(1)}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setClassificationFilter('all')
              setStatusFilter('all')
              void refresh(1)
            }}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Limpar
          </button>
        </div>
      </SectionCard>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
          <div className="flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void refresh(pagination.page || 1)}
              className="rounded-lg bg-white/80 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-white dark:bg-red-950/50 dark:text-red-100"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : null}

      <SectionCard title="Fila de email" subtitle="Classificação e roteamento com vínculo opcional a lead">
        {isPageLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyStateAction
            icon={<Mail className="h-5 w-5 text-sand-600" />}
            title="Nenhum email encontrado"
            description="Ajuste os filtros ou registre um novo email para iniciar a triagem operacional."
            actionLabel="Novo Email"
            onAction={() => openForm()}
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/70">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{item.subject}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${classificationTone(item.classification)}`}>{classificationLabel(item.classification)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{item.sender_name || 'Sem nome'} · {item.sender_email}</span>
                      <span>{formatDateTime(item.received_at)}</span>
                      {item.lead_nome ? <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Lead: {item.lead_nome}</span> : null}
                    </div>
                    {item.snippet ? <p className="text-sm text-gray-600 dark:text-gray-300">{item.snippet}</p> : null}
                    {item.notes ? <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-300">{item.notes}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {item.lead_id ? (
                      <Link
                        href="/leads"
                        className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Abrir Leads
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openForm(item)}
                      className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeItem(item.id)}
                      disabled={deleteMutation.isMutating}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:text-red-200 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <PaginationControls
          page={pagination.page || 1}
          pageSize={pagination.pageSize || PAGE_SIZE}
          total={pagination.total || items.length}
          hasMore={pagination.hasMore}
          isLoading={isPageLoading}
          onPrev={() => void refresh(Math.max(1, (pagination.page || 1) - 1))}
          onNext={() => void refresh((pagination.page || 1) + 1)}
        />
      </SectionCard>

      {confirmDialog}
    </div>
  )
}
