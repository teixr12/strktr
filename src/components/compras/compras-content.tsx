'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useConfirm } from '@/hooks/use-confirm'
import { useCrudMutations } from '@/hooks/use-crud-mutations'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { toast } from '@/hooks/use-toast'
import { fmt, fmtDate } from '@/lib/utils'
import { COMPRA_STATUS_COLORS, COMPRA_URGENCIA_COLORS } from '@/lib/constants'
import { createCompraSchema, type CreateCompraDTO } from '@/shared/schemas/business'
import { FormField, FormInput, FormSelect, FormTextarea } from '@/components/ui/form-field'
import { Plus, Search, ShoppingCart, X } from 'lucide-react'
import {
  EmptyStateAction,
  PageHeader,
  PaginationControls,
  QuickActionBar,
  SectionCard,
} from '@/components/ui/enterprise'
import type { Compra, CompraStatus, CompraUrgencia } from '@/types/database'

const STATUS_OPTIONS: CompraStatus[] = [
  'Solicitado',
  'Pendente Aprovação Cliente',
  'Revisão Cliente',
  'Aprovado',
  'Pedido',
  'Entregue',
  'Cancelado',
]
const URGENCIA_OPTIONS: CompraUrgencia[] = ['Baixa', 'Normal', 'Alta', 'Urgente']
const CATEGORIA_OPTIONS = ['Material', 'Equipamento', 'Ferramenta', 'Servico', 'EPI', 'Outro']

interface Props {
  initialCompras: Compra[]
  obras: { id: string; nome: string }[]
}

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

const PAGE_SIZE = 50

export function ComprasContent({ initialCompras, obras }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Compras
  const usePaginationV1 = featureFlags.uiPaginationV1
  const [compras, setCompras] = useState(initialCompras)
  const [pagination, setPagination] = useState<PaginationMeta>({
    count: initialCompras.length,
    page: 1,
    pageSize: PAGE_SIZE,
    total: initialCompras.length,
    hasMore: false,
  })
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Compra | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CreateCompraDTO>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod v4 input/output type mismatch with @hookform/resolvers
    resolver: zodResolver(createCompraSchema) as any,
    defaultValues: {
      descricao: '',
      categoria: 'Material',
      fornecedor: '',
      obra_id: '',
      valor_estimado: 0,
      valor_real: undefined,
      status: 'Solicitado',
      urgencia: 'Normal',
      notas: '',
      exige_aprovacao_cliente: false,
      reenviar_aprovacao_cliente: false,
    },
  })

  const exigeAprovacao = watch('exige_aprovacao_cliente')

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<Compra>({
    setItems: setCompras,
    basePath: '/api/v1/compras',
    entityName: 'Compra',
    trackSource: 'web',
    trackEntityType: 'compra',
    onSettled: () => refresh(),
  })

  const filtered = useMemo(() => {
    let list = compras
    if (statusFilter !== 'all') list = list.filter((c) => c.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.descricao.toLowerCase().includes(q) || c.fornecedor?.toLowerCase().includes(q) || c.categoria.toLowerCase().includes(q))
    }
    return list
  }, [compras, search, statusFilter])

  async function refresh(targetPage = 1) {
    if (!usePaginationV1) {
      try {
        const data = await apiRequest<Compra[]>('/api/v1/compras?limit=200')
        setCompras(data)
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Erro ao recarregar compras', 'error')
      }
      return
    }

    setIsPageLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const payload = await apiRequestWithMeta<Compra[], PaginationMeta>(`/api/v1/compras?${params.toString()}`)
      setCompras(payload.data)
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
      toast(err instanceof Error ? err.message : 'Erro ao recarregar compras', 'error')
    } finally {
      setIsPageLoading(false)
    }
  }

  useEffect(() => {
    if (!usePaginationV1) return
    void refresh(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usePaginationV1, statusFilter])

  function openForm(c?: Compra) {
    if (c) {
      setEditing(c)
      reset({
        descricao: c.descricao,
        categoria: c.categoria,
        fornecedor: c.fornecedor || '',
        obra_id: c.obra_id || '',
        valor_estimado: c.valor_estimado || 0,
        valor_real: c.valor_real ?? undefined,
        status: c.status,
        urgencia: c.urgencia,
        notas: c.notas || '',
        exige_aprovacao_cliente: Boolean(c.exige_aprovacao_cliente),
        reenviar_aprovacao_cliente: false,
      })
    } else {
      setEditing(null)
      reset({
        descricao: '',
        categoria: 'Material',
        fornecedor: '',
        obra_id: '',
        valor_estimado: 0,
        valor_real: undefined,
        status: 'Solicitado',
        urgencia: 'Normal',
        notas: '',
        exige_aprovacao_cliente: false,
        reenviar_aprovacao_cliente: false,
      })
    }
    setShowForm(true)
  }

  async function onSubmit(data: CreateCompraDTO) {
    const payload = {
      descricao: data.descricao,
      categoria: data.categoria,
      fornecedor: data.fornecedor || null,
      obra_id: data.obra_id || null,
      valor_estimado: data.valor_estimado ?? 0,
      valor_real: data.valor_real ?? null,
      status: data.status,
      urgencia: data.urgencia,
      notas: data.notas || null,
      exige_aprovacao_cliente: data.exige_aprovacao_cliente,
      reenviar_aprovacao_cliente: data.reenviar_aprovacao_cliente,
    }

    let ok: boolean
    if (editing) {
      ok = await updateMutation.mutate(payload, editing.id)
    } else {
      ok = await createMutation.mutate(payload)
    }

    if (ok) {
      setShowForm(false)
      setEditing(null)
    }
  }

  async function updateStatus(id: string, status: CompraStatus) {
    await updateMutation.mutate({ status }, id)
  }

  async function deleteCompra(id: string) {
    const ok = await confirm({ title: 'Excluir compra?', description: 'Essa acao nao pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' })
    if (!ok) return
    await deleteMutation.mutate(undefined, id)
  }

  return (
    <div className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} space-y-4`}>
      <PageHeader
        title="Compras"
        subtitle={`${pagination.total || compras.length} compras registradas`}
        actions={
          <QuickActionBar
            actions={[{
              label: 'Nova Compra',
              icon: <Plus className="h-4 w-4" />,
              onClick: () => openForm(),
              tone: 'warning',
            }]}
          />
        }
      />

      {/* Header + Search */}
      <SectionCard className="p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar compras..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
        </div>
      </SectionCard>

      {/* Status Filters */}
      <SectionCard className="flex flex-wrap gap-2 p-4">
        <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${statusFilter === 'all' ? 'bg-sand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
          {usePaginationV1 ? 'Todas' : `Todas (${compras.length})`}
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${statusFilter === s ? 'bg-sand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {usePaginationV1 ? s : `${s} (${compras.filter((c) => c.status === s).length})`}
          </button>
        ))}
      </SectionCard>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyStateAction
          icon={<ShoppingCart className="h-6 w-6 text-sand-600 dark:text-sand-300" />}
          title="Nenhuma compra encontrada"
          description="Crie compras para controlar materiais, aprovacoes do cliente e urgencias."
          actionLabel="Nova compra"
          onAction={() => openForm()}
        />
      ) : (
        <SectionCard className="grid gap-2 p-3">
          {filtered.map((c) => (
            <div key={c.id} className="glass-card rounded-2xl p-4 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openForm(c)}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{c.descricao}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${COMPRA_STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                    {c.exige_aprovacao_cliente && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">
                        Aprovacao cliente
                      </span>
                    )}
                    {c.blocked_reason && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700">
                        Bloqueado
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${COMPRA_URGENCIA_COLORS[c.urgencia] || 'bg-gray-100 text-gray-600'}`}>
                      {c.urgencia}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {c.categoria} · {c.fornecedor || 'Sem fornecedor'} · {c.obras?.nome || 'Sem obra'}
                  </p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                    <span>Est: {fmt(c.valor_estimado)}</span>
                    {c.valor_real !== null && <span>Real: {fmt(c.valor_real)}</span>}
                    <span>{fmtDate(c.data_solicitacao)}</span>
                  </div>
                  {c.blocked_reason && (
                    <p className="mt-1 text-[11px] text-rose-600">{c.blocked_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <select
                    value={c.status}
                    onChange={(e) => updateStatus(c.id, e.target.value as CompraStatus)}
                    className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 cursor-pointer md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => deleteCompra(c.id)} className="p-1.5 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 transition-all">
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
          <div className="modal-glass modal-animate w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editing ? 'Editar Compra' : 'Nova Compra'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <FormField error={errors.descricao} required>
                <FormInput registration={register('descricao')} hasError={!!errors.descricao} placeholder="Descricao da compra *" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField error={errors.categoria}>
                  <FormSelect registration={register('categoria')} hasError={!!errors.categoria}>
                    {CATEGORIA_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                  </FormSelect>
                </FormField>
                <FormField error={errors.fornecedor}>
                  <FormInput registration={register('fornecedor')} hasError={!!errors.fornecedor} placeholder="Fornecedor" />
                </FormField>
              </div>
              {obras.length > 0 && (
                <FormField error={errors.obra_id}>
                  <FormSelect registration={register('obra_id')} hasError={!!errors.obra_id}>
                    <option value="">Vincular a obra (opcional)</option>
                    {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </FormSelect>
                </FormField>
              )}
              <div className="grid grid-cols-2 gap-3">
                <FormField error={errors.valor_estimado}>
                  <FormInput registration={register('valor_estimado', { valueAsNumber: true })} hasError={!!errors.valor_estimado} placeholder="Valor estimado (R$)" type="number" />
                </FormField>
                <FormField error={errors.valor_real}>
                  <FormInput registration={register('valor_real', { valueAsNumber: true })} hasError={!!errors.valor_real} placeholder="Valor real (R$)" type="number" />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField error={errors.status}>
                  <FormSelect registration={register('status')} hasError={!!errors.status}>
                    {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </FormSelect>
                </FormField>
                <FormField error={errors.urgencia}>
                  <FormSelect registration={register('urgencia')} hasError={!!errors.urgencia}>
                    {URGENCIA_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                  </FormSelect>
                </FormField>
              </div>
              <FormField error={errors.notas}>
                <FormTextarea registration={register('notas')} hasError={!!errors.notas} placeholder="Notas" rows={2} />
              </FormField>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  {...register('exige_aprovacao_cliente')}
                  className="rounded border-gray-300"
                />
                Exigir aprovacao do cliente no portal
              </label>
              {exigeAprovacao && (
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    {...register('reenviar_aprovacao_cliente')}
                    className="rounded border-gray-300"
                  />
                  Reenviar como nova versao para aprovacao
                </label>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button type="submit" disabled={createMutation.isMutating || updateMutation.isMutating} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm disabled:opacity-50">
                  {editing ? 'Salvar' : 'Registrar'}
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
