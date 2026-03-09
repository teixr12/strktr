'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, ExternalLink, FileBadge2, Gavel, Pencil, Plus, RefreshCcw, ShieldAlert, Trash2, X } from 'lucide-react'
import { useConfirm } from '@/hooks/use-confirm'
import { useCrudMutations } from '@/hooks/use-crud-mutations'
import { useToast } from '@/hooks/use-toast'
import { apiRequestWithMeta } from '@/lib/api/client'
import {
  createBureaucracyItemSchema,
  type CreateBureaucracyItemDTO,
} from '@/shared/schemas/bureaucracy'
import type {
  BureaucracyCategory,
  BureaucracyContextOption,
  BureaucracyPriority,
  BureaucracyRecord,
  BureaucracyStatus,
  BureaucracySummary,
} from '@/shared/types/bureaucracy'
import { EmptyStateAction, PageHeader, PaginationControls, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import { FormField, FormInput, FormSelect, FormTextarea } from '@/components/ui/form-field'

interface Props {
  initialItems: BureaucracyRecord[]
  initialSummary: BureaucracySummary
  initialObras: BureaucracyContextOption[]
  initialProjetos: BureaucracyContextOption[]
}

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  summary?: BureaucracySummary
}

const PAGE_SIZE = 50

const CATEGORY_OPTIONS: Array<{ value: BureaucracyCategory; label: string }> = [
  { value: 'prefeitura', label: 'Prefeitura' },
  { value: 'condominio', label: 'Condomínio' },
  { value: 'judicial', label: 'Judicial' },
  { value: 'extrajudicial', label: 'Extrajudicial' },
  { value: 'cartorio', label: 'Cartório' },
  { value: 'documentacao', label: 'Documentação' },
  { value: 'licenciamento', label: 'Licenciamento' },
  { value: 'outro', label: 'Outro' },
]

const STATUS_OPTIONS: Array<{ value: BureaucracyStatus; label: string }> = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'pending', label: 'Pendente' },
  { value: 'in_review', label: 'Em análise' },
  { value: 'waiting_external', label: 'Aguardando externo' },
  { value: 'scheduled', label: 'Agendado' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'archived', label: 'Arquivado' },
]

const PRIORITY_OPTIONS: Array<{ value: BureaucracyPriority; label: string }> = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
]

function categoryLabel(value: BureaucracyCategory) {
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label || value
}

function statusLabel(value: BureaucracyStatus) {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label || value
}

function priorityLabel(value: BureaucracyPriority) {
  return PRIORITY_OPTIONS.find((item) => item.value === value)?.label || value
}

function priorityTone(value: BureaucracyPriority) {
  if (value === 'critical') return 'bg-red-100 text-red-700'
  if (value === 'high') return 'bg-amber-100 text-amber-700'
  if (value === 'medium') return 'bg-blue-100 text-blue-700'
  return 'bg-emerald-100 text-emerald-700'
}

function statusTone(value: BureaucracyStatus) {
  if (value === 'resolved') return 'bg-emerald-100 text-emerald-700'
  if (value === 'archived') return 'bg-gray-100 text-gray-600'
  if (value === 'waiting_external') return 'bg-amber-100 text-amber-700'
  if (value === 'scheduled') return 'bg-blue-100 text-blue-700'
  return 'bg-sand-100 text-sand-700'
}

function formatDate(value: string | null) {
  if (!value) return 'Sem data'
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function toDatetimeLocalValue(value: string | null) {
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

export function BurocraciaContent({ initialItems, initialSummary, initialObras, initialProjetos }: Props) {
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
  const [statusFilter, setStatusFilter] = useState<'all' | BureaucracyStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | BureaucracyCategory>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | BureaucracyPriority>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BureaucracyRecord | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBureaucracyItemDTO>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod resolver generic mismatch
    resolver: zodResolver(createBureaucracyItemSchema) as any,
    defaultValues: {
      titulo: '',
      categoria: 'prefeitura',
      status: 'pending',
      prioridade: 'medium',
      obra_id: '',
      projeto_id: '',
      processo_codigo: '',
      orgao_nome: '',
      responsavel_nome: '',
      responsavel_email: '',
      proxima_acao: '',
      proxima_checagem_em: '',
      reuniao_em: '',
      link_externo: '',
      descricao: '',
    },
  })

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<BureaucracyRecord>({
    setItems,
    basePath: '/api/v1/burocracia',
    entityName: 'Item de burocracia',
    trackSource: 'web',
    trackEntityType: 'bureaucracy_item',
    onSettled: () => void refresh(pagination.page || 1),
  })

  const criticalItems = useMemo(
    () => items.filter((item) => item.prioridade === 'critical' || item.status === 'waiting_external').slice(0, 3),
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
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (categoryFilter !== 'all') params.set('categoria', categoryFilter)
      if (priorityFilter !== 'all') params.set('prioridade', priorityFilter)
      if (search.trim()) params.set('q', search.trim())

      const payload = await apiRequestWithMeta<BureaucracyRecord[], PaginationMeta>(`/api/v1/burocracia?${params.toString()}`)
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
      const message = err instanceof Error ? err.message : 'Erro ao carregar itens de burocracia'
      setLoadError(message)
      toast(message, 'error')
    } finally {
      setIsPageLoading(false)
    }
  }

  useEffect(() => {
    void refresh(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, priorityFilter])

  function openForm(item?: BureaucracyRecord) {
    if (item) {
      setEditing(item)
      reset({
        titulo: item.titulo,
        categoria: item.categoria,
        status: item.status,
        prioridade: item.prioridade,
        obra_id: item.obra_id || '',
        projeto_id: item.projeto_id || '',
        processo_codigo: item.processo_codigo || '',
        orgao_nome: item.orgao_nome || '',
        responsavel_nome: item.responsavel_nome || '',
        responsavel_email: item.responsavel_email || '',
        proxima_acao: item.proxima_acao || '',
        proxima_checagem_em: item.proxima_checagem_em || '',
        reuniao_em: toDatetimeLocalValue(item.reuniao_em),
        link_externo: item.link_externo || '',
        descricao: item.descricao || '',
      })
    } else {
      setEditing(null)
      reset({
        titulo: '',
        categoria: 'prefeitura',
        status: 'pending',
        prioridade: 'medium',
        obra_id: '',
        projeto_id: '',
        processo_codigo: '',
        orgao_nome: '',
        responsavel_nome: '',
        responsavel_email: '',
        proxima_acao: '',
        proxima_checagem_em: '',
        reuniao_em: '',
        link_externo: '',
        descricao: '',
      })
    }
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  async function onSubmit(data: CreateBureaucracyItemDTO) {
    const payload = {
      titulo: data.titulo,
      categoria: data.categoria,
      status: data.status,
      prioridade: data.prioridade,
      obra_id: data.obra_id || null,
      projeto_id: data.projeto_id || null,
      processo_codigo: data.processo_codigo || null,
      orgao_nome: data.orgao_nome || null,
      responsavel_nome: data.responsavel_nome || null,
      responsavel_email: data.responsavel_email || null,
      proxima_acao: data.proxima_acao || null,
      proxima_checagem_em: data.proxima_checagem_em || null,
      reuniao_em: toIsoDatetime(data.reuniao_em),
      link_externo: data.link_externo || null,
      descricao: data.descricao || null,
    }

    const done = editing ? await updateMutation.mutate(payload, editing.id) : await createMutation.mutate(payload)
    if (done) closeForm()
  }

  async function removeItem(id: string) {
    const accepted = await confirm({
      title: 'Excluir item?',
      description: 'Essa ação remove o item de burocracia do controle operacional.',
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
          title="Burocracia"
          subtitle="Controle de prefeitura, condomínio, judicial e documentos críticos"
          actions={
            <QuickActionBar
              actions={[
                {
                  label: 'Novo Item',
                  icon: <Plus className="h-4 w-4" />,
                  onClick: () => openForm(),
                  tone: 'warning',
                },
              ]}
            />
          }
        />
        <EmptyStateAction
          icon={<FileBadge2 className="h-5 w-5 text-sand-600" />}
          title="Nenhum item burocrático cadastrado"
          description="Consolide aprovações, processos e pendências operacionais em um único fluxo real e auditável."
          actionLabel="Novo Item"
          onAction={() => openForm()}
        />
        {showForm ? null : confirmDialog}
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isPageLoading}>
      <PageHeader
        title="Burocracia"
        subtitle={`${pagination.total || items.length} itens monitorados`}
        actions={
          <QuickActionBar
            actions={[
              {
                label: 'Atualizar',
                icon: <RefreshCcw className="h-4 w-4" />,
                onClick: () => void refresh(pagination.page || 1),
              },
              {
                label: 'Novo Item',
                icon: <Plus className="h-4 w-4" />,
                onClick: () => openForm(),
                tone: 'warning',
              },
            ]}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard density="compact" title="Em aberto" subtitle="Itens que ainda exigem ação">
          <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{summary.open}</p>
        </SectionCard>
        <SectionCard density="compact" title="Urgentes" subtitle="Alta ou crítica">
          <p className="text-3xl font-semibold text-red-600">{summary.urgent}</p>
        </SectionCard>
        <SectionCard density="compact" title="Atrasadas" subtitle="Próxima checagem vencida">
          <p className="text-3xl font-semibold text-amber-600">{summary.overdue}</p>
        </SectionCard>
        <SectionCard density="compact" title="Aguardando externo" subtitle="Dependência fora da operação">
          <p className="text-3xl font-semibold text-blue-600">{summary.waitingExternal}</p>
        </SectionCard>
      </div>

      {criticalItems.length > 0 ? (
        <SectionCard
          title="O que precisa de ação agora"
          subtitle="Itens críticos ou travados em terceiros"
          density="compact"
          surface="soft"
        >
          <div className="grid gap-3 md:grid-cols-3">
            {criticalItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-amber-200 bg-white/80 p-3 dark:border-amber-900/40 dark:bg-gray-950/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.titulo}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.orgao_nome || categoryLabel(item.categoria)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityTone(item.prioridade)}`}>{priorityLabel(item.prioridade)}</span>
                </div>
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{item.proxima_acao || 'Definir próxima ação operacional'}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {showForm ? (
        <SectionCard
          title={editing ? 'Editar item burocrático' : 'Novo item burocrático'}
          subtitle="Persistido no backend, com contexto de obra/projeto e próximos passos"
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
            <FormField label="Título" required error={errors.titulo} className="md:col-span-2">
              <FormInput registration={register('titulo')} hasError={!!errors.titulo} placeholder="Ex: Aprovação da prefeitura - alvará complementar" />
            </FormField>
            <FormField label="Categoria" error={errors.categoria}>
              <FormSelect registration={register('categoria')} hasError={!!errors.categoria}>
                {CATEGORY_OPTIONS.map((option) => (
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
            <FormField label="Prioridade" error={errors.prioridade}>
              <FormSelect registration={register('prioridade')} hasError={!!errors.prioridade}>
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Órgão / fonte" error={errors.orgao_nome}>
              <FormInput registration={register('orgao_nome')} hasError={!!errors.orgao_nome} placeholder="Prefeitura, condomínio, cartório..." />
            </FormField>
            <FormField label="Obra vinculada" error={errors.obra_id}>
              <FormSelect registration={register('obra_id')} hasError={!!errors.obra_id}>
                <option value="">Sem obra</option>
                {initialObras.map((obra) => (
                  <option key={obra.id} value={obra.id}>{obra.nome}</option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Projeto vinculado" error={errors.projeto_id}>
              <FormSelect registration={register('projeto_id')} hasError={!!errors.projeto_id}>
                <option value="">Sem projeto</option>
                {initialProjetos.map((projeto) => (
                  <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Código / processo" error={errors.processo_codigo}>
              <FormInput registration={register('processo_codigo')} hasError={!!errors.processo_codigo} placeholder="Número do processo ou protocolo" />
            </FormField>
            <FormField label="Responsável" error={errors.responsavel_nome}>
              <FormInput registration={register('responsavel_nome')} hasError={!!errors.responsavel_nome} placeholder="Quem conduz essa frente" />
            </FormField>
            <FormField label="Email do responsável" error={errors.responsavel_email}>
              <FormInput type="email" registration={register('responsavel_email')} hasError={!!errors.responsavel_email} placeholder="nome@empresa.com" />
            </FormField>
            <FormField label="Próxima ação" error={errors.proxima_acao} className="md:col-span-2">
              <FormInput registration={register('proxima_acao')} hasError={!!errors.proxima_acao} placeholder="Ex: ligar para prefeitura e confirmar exigência documental" />
            </FormField>
            <FormField label="Próxima checagem" error={errors.proxima_checagem_em}>
              <FormInput type="date" registration={register('proxima_checagem_em')} hasError={!!errors.proxima_checagem_em} />
            </FormField>
            <FormField label="Reunião / compromisso" error={errors.reuniao_em}>
              <FormInput type="datetime-local" registration={register('reuniao_em')} hasError={!!errors.reuniao_em} />
            </FormField>
            <FormField label="Link externo" error={errors.link_externo} className="md:col-span-2">
              <FormInput type="url" registration={register('link_externo')} hasError={!!errors.link_externo} placeholder="https://..." />
            </FormField>
            <FormField label="Descrição / contexto" error={errors.descricao} className="md:col-span-2">
              <FormTextarea rows={4} registration={register('descricao')} hasError={!!errors.descricao} placeholder="Detalhes da pendência, exigências e histórico recente" />
            </FormField>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={createMutation.isMutating || updateMutation.isMutating}
                className="rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
              >
                {createMutation.isMutating || updateMutation.isMutating ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar item'}
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

      <SectionCard title="Filtro operacional" subtitle="Refine por status, categoria e prioridade" density="compact">
        <div className="grid gap-3 md:grid-cols-4">
          <FormField label="Buscar">
            <FormInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, órgão, processo" />
          </FormField>
          <FormField label="Status">
            <FormSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | BureaucracyStatus)}>
              <option value="all">Todos</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Categoria">
            <FormSelect value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as 'all' | BureaucracyCategory)}>
              <option value="all">Todas</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FormSelect>
          </FormField>
          <FormField label="Prioridade">
            <FormSelect value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as 'all' | BureaucracyPriority)}>
              <option value="all">Todas</option>
              {PRIORITY_OPTIONS.map((option) => (
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
              setStatusFilter('all')
              setCategoryFilter('all')
              setPriorityFilter('all')
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

      <SectionCard title="Fila burocrática" subtitle="Pendências com contexto e próximos passos">
        {isPageLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyStateAction
            icon={<ShieldAlert className="h-5 w-5 text-sand-600" />}
            title="Nenhum item encontrado"
            description="Ajuste os filtros ou crie um novo item para começar o controle burocrático."
            actionLabel="Novo Item"
            onAction={() => openForm()}
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950/70">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{item.titulo}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityTone(item.prioridade)}`}>{priorityLabel(item.prioridade)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1"><FileBadge2 className="h-3.5 w-3.5" />{categoryLabel(item.categoria)}</span>
                      {item.orgao_nome ? <span className="inline-flex items-center gap-1"><Gavel className="h-3.5 w-3.5" />{item.orgao_nome}</span> : null}
                      {item.processo_codigo ? <span>Processo {item.processo_codigo}</span> : null}
                      {item.obra_nome ? <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{item.obra_nome}</span> : null}
                    </div>
                    {item.descricao ? <p className="text-sm text-gray-600 dark:text-gray-300">{item.descricao}</p> : null}
                    <div className="grid gap-2 text-xs text-gray-500 dark:text-gray-400 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-gray-400">Próxima ação</p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{item.proxima_acao || 'Não definida'}</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-gray-400">Próxima checagem</p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{formatDate(item.proxima_checagem_em)}</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-gray-400">Reunião</p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{item.reuniao_em ? formatDate(item.reuniao_em) : 'Sem agenda'}</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-gray-400">Última atualização</p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{formatDate(item.ultima_atualizacao_em)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {item.link_externo ? (
                      <Link
                        href={item.link_externo}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Link externo
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
