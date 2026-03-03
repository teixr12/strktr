'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useConfirm } from '@/hooks/use-confirm'
import { useCrudMutations } from '@/hooks/use-crud-mutations'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { fmt } from '@/lib/utils'
import { z } from 'zod'
import { createKnowledgeItemSchema, kbCategoriaSchema, type CreateKnowledgeItemDTO } from '@/shared/schemas/business'
import { Plus, X, Trash2, Edit2, Search, BookOpen, Tag } from 'lucide-react'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import { FormField, FormInput, FormTextarea, FormSelect } from '@/components/ui/form-field'
import type { KnowledgebaseItem } from '@/types/database'

const KB_CATEGORIA_COLORS: Record<string, string> = {
  material: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  mao_de_obra: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  equipamento: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  sop: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  referencia: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const KB_CATEGORIA_LABELS: Record<string, string> = {
  material: 'Material',
  mao_de_obra: 'Mao de Obra',
  equipamento: 'Equipamento',
  sop: 'SOP / Procedimento',
  referencia: 'Referencia',
}

interface Props { initialItems: KnowledgebaseItem[] }

/** Form-level Zod schema — keeps tags as comma-separated string and valor_referencia as string */
const kbFormSchema = z.object({
  titulo: z.string().trim().min(2, 'Titulo e obrigatorio'),
  conteudo: z.string(),
  categoria: kbCategoriaSchema,
  unidade: z.string(),
  valor_referencia: z.string(),
  tags: z.string(),
})

type KBFormValues = z.infer<typeof kbFormSchema>

const FORM_DEFAULTS: KBFormValues = {
  titulo: '',
  conteudo: '',
  categoria: 'material',
  unidade: '',
  valor_referencia: '',
  tags: '',
}

export function KnowledgebaseContent({ initialItems }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Knowledgebase
  const [items, setItems] = useState(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<KnowledgebaseItem | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('Todos')
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<KnowledgebaseItem>({
    setItems,
    basePath: '/api/v1/knowledgebase',
    entityName: 'Item',
    trackSource: 'web',
    trackEntityType: 'knowledge_item',
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<KBFormValues>({
    resolver: zodResolver(kbFormSchema),
    defaultValues: FORM_DEFAULTS,
  })

  const categorias = ['Todos', ...Object.keys(KB_CATEGORIA_LABELS)]

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const matchBusca = !busca || i.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        (i.conteudo || '').toLowerCase().includes(busca.toLowerCase()) ||
        (i.tags || []).some((t) => t.toLowerCase().includes(busca.toLowerCase()))
      const matchCategoria = filtroCategoria === 'Todos' || i.categoria === filtroCategoria
      return matchBusca && matchCategoria
    })
  }, [items, busca, filtroCategoria])

  useEffect(() => {
    async function refreshItems() {
      setIsLoadingItems(true)
      setLoadError(null)
      try {
        const refreshed = await apiRequest<KnowledgebaseItem[]>('/api/v1/knowledgebase?ativo=true&limit=250')
        setItems(refreshed)
      } catch {
        setLoadError('Falha ao carregar base de conhecimento. Tentar novamente.')
        toast('Falha ao carregar base de conhecimento. Tentar novamente.', 'error')
      } finally {
        setIsLoadingItems(false)
      }
    }
    void refreshItems()
  }, [])

  function openNew() {
    reset(FORM_DEFAULTS)
    setEditItem(null)
    setShowForm(true)
  }

  function openEdit(item: KnowledgebaseItem) {
    reset({
      titulo: item.titulo,
      conteudo: item.conteudo || '',
      categoria: item.categoria,
      unidade: item.unidade || '',
      valor_referencia: item.valor_referencia ? String(item.valor_referencia) : '',
      tags: (item.tags || []).join(', '),
    })
    setEditItem(item)
    setShowForm(true)
  }

  /** Transform form values into the API payload matching CreateKnowledgeItemDTO */
  function buildPayload(values: KBFormValues): CreateKnowledgeItemDTO {
    return createKnowledgeItemSchema.parse({
      titulo: values.titulo.trim(),
      conteudo: values.conteudo || null,
      categoria: values.categoria,
      unidade: values.unidade || null,
      valor_referencia: values.valor_referencia ? parseFloat(values.valor_referencia) : null,
      tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    })
  }

  async function onSubmit(values: KBFormValues) {
    const payload = buildPayload(values)
    let ok: boolean
    if (editItem) {
      ok = await updateMutation.mutate(payload, editItem.id)
    } else {
      ok = await createMutation.mutate(payload)
    }
    if (ok) {
      setShowForm(false)
      setEditItem(null)
    }
  }

  async function deleteItem(id: string) {
    const ok = await confirm({ title: 'Excluir item?', description: 'Essa acao nao pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' })
    if (!ok) return
    await deleteMutation.mutate(undefined, id)
  }

  const isSaving = createMutation.isMutating || updateMutation.isMutating

  return (
    <div
      aria-busy={
        isLoadingItems ||
        createMutation.isMutating ||
        updateMutation.isMutating ||
        deleteMutation.isMutating
      }
      className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} space-y-5`}
    >
      <PageHeader
        title="Base de Conhecimento"
        subtitle={`${items.length} itens · SOPs, materiais e referencias`}
        actions={
          <QuickActionBar
            actions={[{
              label: 'Novo Item',
              icon: <Plus className="h-4 w-4" />,
              onClick: openNew,
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
              onClick={() => window.location.reload()}
              className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </SectionCard>
      )}

      {isLoadingItems && (
        <SectionCard className="p-4">
          <p className="text-sm text-gray-500">Carregando base de conhecimento...</p>
        </SectionCard>
      )}

      {/* Search + Filters */}
      <SectionCard className="space-y-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por titulo, conteudo ou tags..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categorias.map((c) => (
            <button key={c} onClick={() => setFiltroCategoria(c)} className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${filtroCategoria === c ? 'bg-sand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {c === 'Todos' ? 'Todos' : KB_CATEGORIA_LABELS[c] || c}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyStateAction
          icon={<BookOpen className="h-5 w-5 text-sand-600" />}
          title={items.length === 0 ? 'Base vazia' : 'Nenhum item encontrado'}
          description={items.length === 0 ? 'Adicione artigos, procedimentos e documentos para centralizar conhecimento.' : 'Documente padroes de obra, referencias de preco e procedimentos para reduzir retrabalho.'}
          actionLabel="Novo Artigo"
          onAction={openNew}
        />
      ) : (
        <SectionCard className="p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div key={item.id} className="glass-card rounded-2xl p-4 group hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${KB_CATEGORIA_COLORS[item.categoria] || KB_CATEGORIA_COLORS.referencia}`}>
                  {KB_CATEGORIA_LABELS[item.categoria] || item.categoria}
                </span>
                <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(item)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={() => deleteItem(item.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{item.titulo}</h4>
              {item.conteudo && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.conteudo}</p>}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {item.unidade && <span>{item.unidade}</span>}
                  {item.valor_referencia && <span className="text-sand-600 dark:text-sand-400 font-medium">{fmt(item.valor_referencia)}</span>}
                </div>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-gray-300" />
                    <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{item.tags.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
        </SectionCard>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editItem ? 'Editar Item' : 'Novo Item'}</h3>
              <button onClick={() => { setShowForm(false); setEditItem(null) }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <FormField error={errors.titulo} required>
                <FormInput
                  registration={register('titulo')}
                  hasError={!!errors.titulo}
                  placeholder="Titulo *"
                />
              </FormField>
              <FormField error={errors.categoria}>
                <FormSelect registration={register('categoria')} hasError={!!errors.categoria}>
                  {Object.entries(KB_CATEGORIA_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField error={errors.conteudo}>
                <FormTextarea
                  registration={register('conteudo')}
                  hasError={!!errors.conteudo}
                  placeholder="Conteudo / Descricao"
                  rows={3}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField error={errors.unidade}>
                  <FormInput
                    registration={register('unidade')}
                    hasError={!!errors.unidade}
                    placeholder="Unidade (m2, kg, h)"
                  />
                </FormField>
                <FormField error={errors.valor_referencia}>
                  <FormInput
                    registration={register('valor_referencia')}
                    hasError={!!errors.valor_referencia}
                    placeholder="Valor referencia (R$)"
                    type="number"
                  />
                </FormField>
              </div>
              <FormField error={errors.tags}>
                <FormInput
                  registration={register('tags')}
                  hasError={!!errors.tags}
                  placeholder="Tags (separar por virgula)"
                />
              </FormField>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditItem(null) }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm disabled:opacity-60">
                  {isSaving ? 'Salvando...' : editItem ? 'Salvar' : 'Adicionar'}
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
