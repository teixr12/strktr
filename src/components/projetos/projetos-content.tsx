'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { toast } from '@/hooks/use-toast'
import { useConfirm } from '@/hooks/use-confirm'
import { useCrudMutations } from '@/hooks/use-crud-mutations'
import { fmt, fmtDate } from '@/lib/utils'
import { PROJETO_STATUS_COLORS } from '@/lib/constants'
import { createProjetoSchema, type CreateProjetoDTO } from '@/shared/schemas/business'
import { Plus, Search, FolderKanban, ArrowRight, X } from 'lucide-react'
import {
  EmptyStateAction,
  PageHeader,
  PaginationControls,
  QuickActionBar,
  SectionCard,
} from '@/components/ui/enterprise'
import { FormField, FormInput, FormSelect, FormTextarea } from '@/components/ui/form-field'
import type { Projeto, ProjetoStatus } from '@/types/database'

const STATUS_OPTIONS: ProjetoStatus[] = ['Planejamento', 'Em Aprovação', 'Aprovado', 'Em Execução', 'Concluído', 'Arquivado']
const TIPO_OPTIONS = ['Residencial', 'Comercial', 'Industrial', 'Reforma', 'Infraestrutura', 'Outro']

interface Props {
  initialProjetos: Projeto[]
  leads: { id: string; nome: string }[]
}

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

const PAGE_SIZE = 50

export function ProjetosContent({ initialProjetos, leads }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Projetos
  const usePaginationV1 = featureFlags.uiPaginationV1
  const [projetos, setProjetos] = useState(initialProjetos)
  const [pagination, setPagination] = useState<PaginationMeta>({
    count: initialProjetos.length,
    page: 1,
    pageSize: PAGE_SIZE,
    total: initialProjetos.length,
    hasMore: false,
  })
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Projeto | null>(null)

  const defaultValues: CreateProjetoDTO = {
    nome: '',
    descricao: null,
    cliente: null,
    local: null,
    tipo: 'Residencial',
    status: 'Planejamento',
    valor_estimado: 0,
    area_m2: null,
    lead_id: null,
    obra_id: null,
    data_inicio_prev: null,
    data_fim_prev: null,
    notas: null,
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjetoDTO>({
    resolver: zodResolver(createProjetoSchema) as never,
    defaultValues,
  })

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<Projeto>({
    setItems: setProjetos,
    basePath: '/api/v1/projetos',
    entityName: 'Projeto',
    trackSource: 'web',
    trackEntityType: 'projeto',
    onSettled: () => refresh?.(pagination.page),
  })

  const filtered = useMemo(() => {
    let list = projetos
    if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.nome.toLowerCase().includes(q) || p.cliente?.toLowerCase().includes(q) || p.local?.toLowerCase().includes(q))
    }
    return list
  }, [projetos, search, statusFilter])

  async function refresh(targetPage = 1) {
    if (!usePaginationV1) {
      try {
        setLoadError(null)
        const data = await apiRequest<Projeto[]>('/api/v1/projetos?page=1&pageSize=100')
        setProjetos(data)
      } catch (err) {
        const message = err instanceof Error ? `${err.message}. Tentar novamente.` : 'Erro ao recarregar projetos. Tentar novamente.'
        setLoadError(message)
        toast(message, 'error')
      }
      return
    }

    setIsPageLoading(true)
    try {
      setLoadError(null)
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const payload = await apiRequestWithMeta<Projeto[], PaginationMeta>(`/api/v1/projetos?${params.toString()}`)
      setProjetos(payload.data)
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
      const message = err instanceof Error ? `${err.message}. Tentar novamente.` : 'Erro ao recarregar projetos. Tentar novamente.'
      setLoadError(message)
      toast(message, 'error')
    } finally {
      setIsPageLoading(false)
    }
  }

  useEffect(() => {
    if (!usePaginationV1) return
    void refresh(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePaginationV1, statusFilter])

  function openForm(p?: Projeto) {
    if (p) {
      setEditing(p)
      reset({
        nome: p.nome,
        descricao: p.descricao || null,
        cliente: p.cliente || null,
        local: p.local || null,
        tipo: p.tipo,
        status: p.status,
        valor_estimado: p.valor_estimado || 0,
        area_m2: p.area_m2 || null,
        lead_id: p.lead_id || null,
        obra_id: p.obra_id || null,
        data_inicio_prev: p.data_inicio_prev || null,
        data_fim_prev: p.data_fim_prev || null,
        notas: p.notas || null,
      })
    } else {
      setEditing(null)
      reset(defaultValues)
    }
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    reset(defaultValues)
  }

  async function onSubmit(data: CreateProjetoDTO) {
    const payload = {
      ...data,
      lead_id: data.lead_id || null,
      obra_id: data.obra_id || null,
    }

    let ok: boolean
    if (editing) {
      ok = await updateMutation.mutate(payload, editing.id)
    } else {
      ok = await createMutation.mutate(payload)
    }

    if (ok) {
      closeForm()
    }
  }

  async function convertToObra(p: Projeto) {
    const ok = await confirm({ title: `Converter "${p.nome}" em Obra?`, description: 'O projeto será convertido em uma obra ativa.', confirmLabel: 'Converter' })
    if (!ok) return
    try {
      await apiRequest<{ obra: { id: string } }>(`/api/v1/projetos/${p.id}/convert-to-obra`, { method: 'POST' })
      toast('Obra criada a partir do projeto!', 'success')
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao converter projeto', 'error')
    }
  }

  async function deleteProjeto(id: string) {
    const ok = await confirm({ title: 'Excluir projeto?', description: 'Essa ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' })
    if (!ok) return
    await deleteMutation.mutate(undefined, id)
  }

  return (
    <div aria-busy={isPageLoading || createMutation.isMutating || updateMutation.isMutating || deleteMutation.isMutating} className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} space-y-4`}>
      <PageHeader
        title="Projetos"
        subtitle={`${pagination.total || projetos.length} projetos no workspace`}
        actions={
          <QuickActionBar
            actions={[{
              label: 'Novo Projeto',
              icon: <Plus className="h-4 w-4" />,
              onClick: () => openForm(),
              tone: 'warning',
            }]}
          />
        }
      />

      {loadError && (
        <SectionCard className="p-4 border border-red-200/70 dark:border-red-800/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
            <button
              onClick={() => void refresh(pagination.page || 1)}
              className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </SectionCard>
      )}

      {/* Header + Search */}
      <SectionCard className="p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar projetos..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
        </div>
      </SectionCard>

      {/* Status Filters */}
      <SectionCard className="flex flex-wrap gap-2 p-4">
        <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${statusFilter === 'all' ? 'bg-sand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
          {usePaginationV1 ? 'Todos' : `Todos (${projetos.length})`}
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${statusFilter === s ? 'bg-sand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {usePaginationV1 ? s : `${s} (${projetos.filter((p) => p.status === s).length})`}
          </button>
        ))}
      </SectionCard>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyStateAction
          icon={<FolderKanban className="h-6 w-6 text-sand-600 dark:text-sand-300" />}
          title="Nenhum projeto encontrado"
          description="Cadastre um projeto e converta para obra quando o escopo estiver aprovado."
          actionLabel="Novo projeto"
          onAction={() => openForm()}
        />
      ) : (
        <SectionCard className="grid gap-3 p-3">
          {filtered.map((p) => (
            <div key={p.id} className="glass-card rounded-2xl p-4 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openForm(p)}>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{p.nome}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${PROJETO_STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{p.cliente || '—'} · {p.local || '—'} · {p.tipo}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {p.valor_estimado > 0 && <span>{fmt(p.valor_estimado)}</span>}
                    {p.area_m2 && <span>{p.area_m2}m2</span>}
                    {p.data_inicio_prev && <span>Inicio: {fmtDate(p.data_inicio_prev)}</span>}
                    {p.leads?.nome && <span>Lead: {p.leads.nome}</span>}
                    {p.obras?.nome && <span>Obra: {p.obras.nome}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  {!p.obra_id && (
                    <button onClick={() => convertToObra(p)} title="Converter em Obra" className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg text-emerald-500 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deleteProjeto(p.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {usePaginationV1 ? (
            <PaginationControls
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              hasMore={pagination.hasMore}
              isLoading={isPageLoading}
              onPrev={() => void refresh(Math.max(1, pagination.page - 1))}
              onNext={() => void refresh(pagination.page + 1)}
            />
          ) : null}
        </SectionCard>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? 'Editar Projeto' : 'Novo Projeto'}
              </h3>
              <button onClick={closeForm} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <FormField label="Nome" error={errors.nome} required>
                <FormInput
                  registration={register('nome')}
                  hasError={!!errors.nome}
                  placeholder="Nome do projeto *"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Cliente" error={errors.cliente}>
                  <FormInput
                    registration={register('cliente')}
                    hasError={!!errors.cliente}
                    placeholder="Cliente"
                  />
                </FormField>
                <FormField label="Local" error={errors.local}>
                  <FormInput
                    registration={register('local')}
                    hasError={!!errors.local}
                    placeholder="Local"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Tipo" error={errors.tipo} required>
                  <FormSelect registration={register('tipo')} hasError={!!errors.tipo}>
                    {TIPO_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </FormSelect>
                </FormField>
                <FormField label="Status" error={errors.status}>
                  <FormSelect registration={register('status')} hasError={!!errors.status}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </FormSelect>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Valor estimado (R$)" error={errors.valor_estimado}>
                  <FormInput
                    registration={register('valor_estimado', { valueAsNumber: true })}
                    hasError={!!errors.valor_estimado}
                    placeholder="Valor estimado (R$)"
                    type="number"
                    step="0.01"
                  />
                </FormField>
                <FormField label="Area (m2)" error={errors.area_m2}>
                  <FormInput
                    registration={register('area_m2', { valueAsNumber: true })}
                    hasError={!!errors.area_m2}
                    placeholder="Area (m2)"
                    type="number"
                    step="0.01"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Inicio previsto" error={errors.data_inicio_prev}>
                  <FormInput
                    registration={register('data_inicio_prev')}
                    hasError={!!errors.data_inicio_prev}
                    type="date"
                  />
                </FormField>
                <FormField label="Fim previsto" error={errors.data_fim_prev}>
                  <FormInput
                    registration={register('data_fim_prev')}
                    hasError={!!errors.data_fim_prev}
                    type="date"
                  />
                </FormField>
              </div>
              {leads.length > 0 && (
                <FormField label="Lead" error={errors.lead_id}>
                  <FormSelect registration={register('lead_id')} hasError={!!errors.lead_id}>
                    <option value="">Vincular a lead (opcional)</option>
                    {leads.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </FormSelect>
                </FormField>
              )}
              <FormField label="Notas" error={errors.notas}>
                <FormTextarea
                  registration={register('notas')}
                  hasError={!!errors.notas}
                  placeholder="Notas"
                  rows={2}
                />
              </FormField>
              <FormField label="Descricao" error={errors.descricao}>
                <FormTextarea
                  registration={register('descricao')}
                  hasError={!!errors.descricao}
                  placeholder="Descricao"
                  rows={2}
                />
              </FormField>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeForm} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button
                  type="submit"
                  disabled={createMutation.isMutating || updateMutation.isMutating}
                  className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm disabled:opacity-50"
                >
                  {(createMutation.isMutating || updateMutation.isMutating) ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  )
}
