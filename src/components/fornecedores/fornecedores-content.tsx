'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useConfirm } from '@/hooks/use-confirm'
import { useCrudMutations } from '@/hooks/use-crud-mutations'
import { apiRequestWithMeta } from '@/lib/api/client'
import { toast } from '@/hooks/use-toast'
import { fmtN } from '@/lib/utils'
import { createSupplierSchema, type CreateSupplierDTO } from '@/shared/schemas/supplier-management'
import type { SupplierRecord, SupplierStatus, SupplierSummary } from '@/shared/types/supplier-management'
import { EmptyStateAction, PageHeader, PaginationControls, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import { FormField, FormInput, FormSelect, FormTextarea } from '@/components/ui/form-field'
import { AlertTriangle, Building2, Plus, ShieldAlert, ShieldCheck, Star, Trash2, Pencil, X } from 'lucide-react'

interface Props {
  initialSuppliers: SupplierRecord[]
  initialSummary: SupplierSummary
}

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  summary?: SupplierSummary
}

const PAGE_SIZE = 50

const STATUS_OPTIONS: Array<{ value: SupplierStatus; label: string }> = [
  { value: 'active', label: 'Ativo' },
  { value: 'watchlist', label: 'Observação' },
  { value: 'blocked', label: 'Bloqueado' },
]

function statusLabel(status: SupplierStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status
}

function statusTone(status: SupplierStatus) {
  if (status === 'blocked') return 'bg-red-100 text-red-700'
  if (status === 'watchlist') return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

export function FornecedoresContent({ initialSuppliers, initialSummary }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [summary, setSummary] = useState(initialSummary)
  const [pagination, setPagination] = useState<PaginationMeta>({
    count: initialSuppliers.length,
    page: 1,
    pageSize: PAGE_SIZE,
    total: initialSuppliers.length,
    hasMore: false,
    summary: initialSummary,
  })
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SupplierStatus>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SupplierRecord | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSupplierDTO>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zod resolver generic mismatch
    resolver: zodResolver(createSupplierSchema) as any,
    defaultValues: {
      nome: '',
      documento: '',
      email: '',
      telefone: '',
      cidade: '',
      estado: '',
      status: 'active',
      score_manual: 60,
      notas: '',
    },
  })

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<SupplierRecord>({
    setItems: setSuppliers,
    basePath: '/api/v1/fornecedores',
    entityName: 'Fornecedor',
    trackSource: 'web',
    trackEntityType: 'fornecedor',
    onSettled: () => void refresh(pagination.page || 1),
  })

  const filtered = useMemo(() => {
    let next = suppliers
    if (statusFilter !== 'all') next = next.filter((item) => item.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      next = next.filter((item) =>
        [item.nome, item.documento || '', item.email || '', item.cidade || '', item.estado || '']
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    }
    return next
  }, [suppliers, search, statusFilter])

  async function refresh(targetPage = 1) {
    setIsPageLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search.trim()) params.set('q', search.trim())
      const payload = await apiRequestWithMeta<SupplierRecord[], PaginationMeta>(`/api/v1/fornecedores?${params.toString()}`)
      setSuppliers(payload.data)
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
      const message = err instanceof Error ? err.message : 'Erro ao carregar fornecedores'
      setLoadError(message)
      toast(message, 'error')
    } finally {
      setIsPageLoading(false)
    }
  }

  useEffect(() => {
    void refresh(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  function openForm(item?: SupplierRecord) {
    if (item) {
      setEditing(item)
      reset({
        nome: item.nome,
        documento: item.documento || '',
        email: item.email || '',
        telefone: item.telefone || '',
        cidade: item.cidade || '',
        estado: item.estado || '',
        status: item.status,
        score_manual: item.score_manual,
        notas: item.notas || '',
      })
    } else {
      setEditing(null)
      reset({
        nome: '',
        documento: '',
        email: '',
        telefone: '',
        cidade: '',
        estado: '',
        status: 'active',
        score_manual: 60,
        notas: '',
      })
    }
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  async function onSubmit(data: CreateSupplierDTO) {
    const payload = {
      nome: data.nome,
      documento: data.documento || null,
      email: data.email || null,
      telefone: data.telefone || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      status: data.status,
      score_manual: data.score_manual,
      notas: data.notas || null,
    }

    const ok = editing
      ? await updateMutation.mutate(payload, editing.id)
      : await createMutation.mutate(payload)

    if (ok) {
      closeForm()
    }
  }

  async function removeSupplier(id: string) {
    const accepted = await confirm({
      title: 'Excluir fornecedor?',
      description: 'Essa ação remove o cadastro do fornecedor.',
      confirmLabel: 'Excluir',
      variant: 'danger',
    })
    if (!accepted) return
    await deleteMutation.mutate(undefined, id)
  }

  if (!isPageLoading && suppliers.length === 0 && !showForm) {
    return (
      <div className="tailadmin-page space-y-4">
        <PageHeader
          title="Fornecedores"
          subtitle="Cadastro e governança de fornecedores"
          actions={
            <QuickActionBar
              actions={[
                {
                  label: 'Novo Fornecedor',
                  icon: <Plus className="h-4 w-4" />,
                  onClick: () => openForm(),
                  tone: 'warning',
                },
              ]}
            />
          }
        />
        <EmptyStateAction
          icon={<Building2 className="h-5 w-5 text-sand-600" />}
          title="Nenhum fornecedor cadastrado"
          description="Cadastre fornecedores para acompanhar score, blacklist e histórico operacional."
          actionLabel="Novo Fornecedor"
          onAction={() => openForm()}
        />
        {showForm ? null : confirmDialog}
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4">
      <PageHeader
        title="Fornecedores"
        subtitle={`${pagination.total || suppliers.length} fornecedores cadastrados`}
        actions={
          <QuickActionBar
            actions={[
              {
                label: 'Novo Fornecedor',
                icon: <Plus className="h-4 w-4" />,
                onClick: () => openForm(),
                tone: 'warning',
              },
            ]}
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Building2 className="h-3.5 w-3.5" />
            Total
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.total}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ativos
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.active}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            Observação
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{summary.watchlist}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Star className="h-3.5 w-3.5" />
            Score médio
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{fmtN(summary.averageScore)}</p>
        </SectionCard>
      </div>

      <SectionCard className="p-4">
        <div className="flex flex-col gap-2 lg:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, documento ou email..."
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void refresh(1)
              }}
              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Atualizar
            </button>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | SupplierStatus)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="all">Todos os status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      {loadError ? (
        <SectionCard className="p-4 border border-red-200/70 dark:border-red-800/70">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
            <button
              type="button"
              onClick={() => void refresh(pagination.page || 1)}
              className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard className="space-y-2 p-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Nenhum fornecedor encontrado para o filtro atual.</p>
          ) : (
            filtered.map((supplier) => (
              <div
                key={supplier.id}
                className="flex flex-col gap-3 rounded-xl bg-white/60 p-3 md:flex-row md:items-center md:justify-between dark:bg-gray-800/50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{supplier.nome}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(supplier.status)}`}>
                      {statusLabel(supplier.status)}
                    </span>
                    {supplier.status === 'blocked' ? <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> : null}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {[supplier.documento || 'Sem documento', supplier.email || 'Sem email', supplier.cidade || supplier.estado ? `${supplier.cidade || ''}${supplier.cidade && supplier.estado ? ' · ' : ''}${supplier.estado || ''}` : 'Sem localização']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {supplier.notas ? (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">{supplier.notas}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="rounded-xl border border-gray-200 px-3 py-2 text-center dark:border-gray-700">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Score</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{supplier.score_manual}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openForm(supplier)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <Pencil className="mr-1 inline h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeSupplier(supplier.id)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                    Excluir
                  </button>
                </div>
              </div>
            ))
          )}
          <PaginationControls
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            hasMore={pagination.hasMore}
            isLoading={isPageLoading}
            onPrev={() => void refresh(Math.max(1, pagination.page - 1))}
            onNext={() => void refresh(pagination.page + 1)}
          />
        </SectionCard>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4">
          <div className="modal-glass modal-animate w-full rounded-t-3xl p-6 shadow-2xl md:max-w-xl md:rounded-3xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
              <button type="button" onClick={closeForm} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Nome" error={errors.nome} required>
                  <FormInput registration={register('nome')} hasError={!!errors.nome} placeholder="Nome do fornecedor" />
                </FormField>
                <FormField label="Documento" error={errors.documento}>
                  <FormInput registration={register('documento')} hasError={!!errors.documento} placeholder="CNPJ/CPF" />
                </FormField>
                <FormField label="Email" error={errors.email}>
                  <FormInput registration={register('email')} hasError={!!errors.email} placeholder="Email" />
                </FormField>
                <FormField label="Telefone" error={errors.telefone}>
                  <FormInput registration={register('telefone')} hasError={!!errors.telefone} placeholder="Telefone" />
                </FormField>
                <FormField label="Cidade" error={errors.cidade}>
                  <FormInput registration={register('cidade')} hasError={!!errors.cidade} placeholder="Cidade" />
                </FormField>
                <FormField label="Estado" error={errors.estado}>
                  <FormInput registration={register('estado')} hasError={!!errors.estado} placeholder="UF" />
                </FormField>
                <FormField label="Status" error={errors.status}>
                  <FormSelect registration={register('status')} hasError={!!errors.status}>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField label="Score manual" error={errors.score_manual}>
                  <FormInput registration={register('score_manual', { valueAsNumber: true })} hasError={!!errors.score_manual} type="number" min={0} max={100} />
                </FormField>
              </div>
              <FormField label="Notas" error={errors.notas}>
                <FormTextarea registration={register('notas')} hasError={!!errors.notas} rows={4} placeholder="Observações, histórico, restrições..." />
              </FormField>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={closeForm} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isMutating || updateMutation.isMutating}
                  className="rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
                >
                  {editing ? 'Salvar' : 'Criar fornecedor'}
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
