'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useConfirm } from '@/hooks/use-confirm'
import { useCrudMutations } from '@/hooks/use-crud-mutations'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import { fmt } from '@/lib/utils'
import { MEMBRO_STATUS_COLORS } from '@/lib/constants'
import { createMembroSchema, type CreateMembroDTO } from '@/shared/schemas/business'
import { FormField, FormInput, FormSelect } from '@/components/ui/form-field'
import { Plus, X, Trash2, Edit2, Search, Star, Phone, Mail, Users } from 'lucide-react'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import type { Membro } from '@/types/database'

interface Props { initialMembros: Membro[] }

export function EquipeContent({ initialMembros }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Equipe
  const [membros, setMembros] = useState(initialMembros)
  const [showForm, setShowForm] = useState(false)
  const [editMembro, setEditMembro] = useState<Membro | null>(null)
  const [busca, setBusca] = useState('')
  const [isLoadingMembros, setIsLoadingMembros] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<Membro>({
    setItems: setMembros,
    basePath: '/api/v1/equipe',
    entityName: 'Membro',
    trackSource: 'web',
    trackEntityType: 'membro',
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateMembroDTO>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod v4 input/output type mismatch with @hookform/resolvers
    resolver: zodResolver(createMembroSchema) as any,
    defaultValues: {
      nome: '',
      cargo: '',
      telefone: '',
      email: '',
      especialidade: '',
      status: 'Ativo',
      avaliacao: 5,
      valor_hora: undefined,
    },
  })

  const ativos = membros.filter((m) => m.status === 'Ativo').length

  const filtered = useMemo(() => {
    if (!busca) return membros
    const q = busca.toLowerCase()
    return membros.filter((m) => m.nome.toLowerCase().includes(q) || m.cargo.toLowerCase().includes(q))
  }, [membros, busca])

  useEffect(() => {
    async function refreshMembros() {
      setIsLoadingMembros(true)
      setLoadError(null)
      try {
        const refreshed = await apiRequest<Membro[]>('/api/v1/equipe?limit=120')
        setMembros(refreshed)
      } catch {
        setLoadError('Falha ao carregar equipe. Tentar novamente.')
        toast('Falha ao carregar equipe. Tentar novamente.', 'error')
      } finally {
        setIsLoadingMembros(false)
      }
    }
    void refreshMembros()
  }, [])

  function openNew() {
    reset({
      nome: '',
      cargo: '',
      telefone: '',
      email: '',
      especialidade: '',
      status: 'Ativo',
      avaliacao: 5,
      valor_hora: undefined,
    })
    setEditMembro(null)
    setShowForm(true)
  }

  function openEdit(m: Membro) {
    reset({
      nome: m.nome,
      cargo: m.cargo,
      telefone: m.telefone || '',
      email: m.email || '',
      especialidade: m.especialidade || '',
      status: m.status,
      avaliacao: m.avaliacao,
      valor_hora: m.valor_hora ?? undefined,
    })
    setEditMembro(m)
    setShowForm(true)
  }

  async function onSubmit(data: CreateMembroDTO) {
    const payload = {
      nome: data.nome,
      cargo: data.cargo,
      telefone: data.telefone || null,
      email: data.email || null,
      especialidade: data.especialidade || null,
      status: data.status,
      avaliacao: data.avaliacao ?? 5,
      valor_hora: data.valor_hora ?? null,
    }

    let ok: boolean
    if (editMembro) {
      ok = await updateMutation.mutate(payload, editMembro.id)
    } else {
      ok = await createMutation.mutate(payload)
    }

    if (ok) {
      setShowForm(false)
      setEditMembro(null)
    }
  }

  async function deleteMembro(id: string) {
    const ok = await confirm({ title: 'Excluir membro?', description: 'Essa ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' })
    if (!ok) return
    await deleteMutation.mutate(undefined, id)
  }

  function renderStars(rating: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-3 h-3 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
    ))
  }

  return (
    <div
      aria-busy={
        isLoadingMembros ||
        createMutation.isMutating ||
        updateMutation.isMutating ||
        deleteMutation.isMutating
      }
      className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} space-y-5`}
    >
      <PageHeader
        title="Equipe"
        subtitle={`${membros.length} membros · ${ativos} ativos`}
        actions={
          <QuickActionBar
            actions={[{
              label: 'Novo Membro',
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

      {isLoadingMembros && (
        <SectionCard className="p-4">
          <p className="text-sm text-gray-500">Carregando equipe...</p>
        </SectionCard>
      )}

      {/* Search */}
      <SectionCard className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
        </div>
      </SectionCard>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyStateAction
          icon={<Users className="h-5 w-5 text-sand-600" />}
          title={membros.length === 0 ? 'Nenhum membro na equipe' : 'Nenhum membro encontrado'}
          description={membros.length === 0 ? 'Adicione membros para definir permissões e acompanhar produtividade.' : 'Monte o time da obra para distribuir tarefas e acompanhar produtividade.'}
          actionLabel="Adicionar Membro"
          onAction={openNew}
        />
      ) : (
        <SectionCard className="p-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <div key={m.id} className="glass-card rounded-2xl p-4 group hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Image
                    src={m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nome)}&background=d4a373&color=fff`}
                    alt={m.nome}
                    width={44}
                    height={44}
                    className="w-11 h-11 rounded-xl"
                  />
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{m.nome}</h4>
                    <p className="text-xs text-gray-500">{m.cargo}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${MEMBRO_STATUS_COLORS[m.status] || MEMBRO_STATUS_COLORS.Ativo}`}>
                  {m.status}
                </span>
              </div>

              {m.especialidade && <p className="text-xs text-gray-500 mb-2">{m.especialidade}</p>}

              <div className="flex items-center gap-1 mb-2">{renderStars(m.avaliacao)}</div>

              <div className="space-y-1 text-xs">
                {m.telefone && <div className="flex items-center gap-1.5 text-gray-500"><Phone className="w-3 h-3" />{m.telefone}</div>}
                {m.email && <div className="flex items-center gap-1.5 text-gray-500"><Mail className="w-3 h-3" />{m.email}</div>}
                {m.valor_hora && <div className="text-sand-600 dark:text-sand-400 font-medium">{fmt(m.valor_hora)}/h</div>}
              </div>

              <div className="flex gap-1 mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                <button onClick={() => openEdit(m)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
                <button onClick={() => deleteMembro(m.id)} className="flex items-center justify-center gap-1 py-1.5 px-3 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            </div>
          ))}
          </div>
        </SectionCard>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editMembro ? 'Editar Membro' : 'Novo Membro'}</h3>
              <button onClick={() => { setShowForm(false); setEditMembro(null) }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <FormField error={errors.nome} required>
                <FormInput registration={register('nome')} hasError={!!errors.nome} placeholder="Nome *" />
              </FormField>
              <FormField error={errors.cargo} required>
                <FormInput registration={register('cargo')} hasError={!!errors.cargo} placeholder="Cargo *" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField error={errors.telefone}>
                  <FormInput registration={register('telefone')} hasError={!!errors.telefone} placeholder="Telefone" />
                </FormField>
                <FormField error={errors.email}>
                  <FormInput registration={register('email')} hasError={!!errors.email} placeholder="Email" type="email" />
                </FormField>
              </div>
              <FormField error={errors.especialidade}>
                <FormInput registration={register('especialidade')} hasError={!!errors.especialidade} placeholder="Especialidade" />
              </FormField>
              <div className="grid grid-cols-3 gap-3">
                <FormField error={errors.status}>
                  <FormSelect registration={register('status')} hasError={!!errors.status}>
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Férias">Férias</option>
                  </FormSelect>
                </FormField>
                <FormField error={errors.avaliacao}>
                  <FormInput registration={register('avaliacao', { valueAsNumber: true })} hasError={!!errors.avaliacao} placeholder="Avaliação" type="number" min={1} max={5} step={0.5} />
                </FormField>
                <FormField error={errors.valor_hora}>
                  <FormInput registration={register('valor_hora', { valueAsNumber: true })} hasError={!!errors.valor_hora} placeholder="R$/h" type="number" />
                </FormField>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditMembro(null) }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button type="submit" disabled={createMutation.isMutating || updateMutation.isMutating} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm disabled:opacity-50">
                  {editMembro ? 'Salvar' : 'Adicionar'}
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
