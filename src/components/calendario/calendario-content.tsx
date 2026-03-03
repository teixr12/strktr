'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiRequest } from '@/lib/api/client'
import { useConfirm } from '@/hooks/use-confirm'
import { useCrudMutations } from '@/hooks/use-crud-mutations'
import { fmtDateTime } from '@/lib/utils'
import { TIPO_VISITA_COLORS, VISITA_STATUS_COLORS } from '@/lib/constants'
import { Plus, X, Trash2, CalendarDays, Clock, MapPin, Pencil } from 'lucide-react'
import { featureFlags } from '@/lib/feature-flags'
import { createVisitaSchema, type CreateVisitaDTO } from '@/shared/schemas/business'
import { FormField, FormInput, FormTextarea, FormSelect } from '@/components/ui/form-field'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import type { Visita, Lead, Obra } from '@/types/database'
import type { AgendaTask } from '@/shared/types/cronograma'

interface Props { initialVisitas: Visita[] }

export function CalendarioContent({ initialVisitas }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2Agenda
  const [visitas, setVisitas] = useState(initialVisitas)
  const [showForm, setShowForm] = useState(false)
  const [editingVisita, setEditingVisita] = useState<Visita | null>(null)
  const [obras, setObras] = useState<Pick<Obra, 'id' | 'nome'>[]>([])
  const [leads, setLeads] = useState<Pick<Lead, 'id' | 'nome'>[]>([])
  const [agendaTasks, setAgendaTasks] = useState<AgendaTask[]>([])

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<Visita>({
    setItems: setVisitas,
    basePath: '/api/v1/visitas',
    entityName: 'Visita',
    trackSource: 'web',
    trackEntityType: 'visita',
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateVisitaDTO>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod v4 input/output type mismatch with @hookform/resolvers
    resolver: zodResolver(createVisitaSchema) as any,
    defaultValues: {
      titulo: '',
      tipo: 'Visita',
      data_hora: '',
      duracao_min: 60,
      local: '',
      obra_id: null,
      lead_id: null,
      status: 'Agendado',
      notas: '',
    },
  })

  useEffect(() => {
    async function load() {
      try {
        const [obrasData, leadsData] = await Promise.all([
          apiRequest<Pick<Obra, 'id' | 'nome'>[]>('/api/v1/obras?limit=200'),
          apiRequest<Pick<Lead, 'id' | 'nome'>[]>('/api/v1/leads?limit=200'),
        ])
        setObras(obrasData)
        setLeads(leadsData)
      } catch {
        setObras([])
        setLeads([])
      }
    }
    load()
  }, [])

  useEffect(() => {
    async function loadAgendaTasks() {
      if (!featureFlags.architectAgenda) {
        setAgendaTasks([])
        return
      }
      try {
        const payload = await apiRequest<{ tasks: AgendaTask[] }>('/api/v1/agenda/arquiteto')
        setAgendaTasks(payload.tasks || [])
      } catch {
        setAgendaTasks([])
      }
    }
    loadAgendaTasks()
  }, [])

  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const grouped = useMemo(() => {
    const hoje: Visita[] = []
    const proximas: Visita[] = []
    const passadas: Visita[] = []

    for (const v of visitas) {
      const d = v.data_hora.slice(0, 10)
      if (d === today) hoje.push(v)
      else if (d > today) proximas.push(v)
      else passadas.push(v)
    }
    // Sort upcoming asc, past desc
    proximas.sort((a, b) => a.data_hora.localeCompare(b.data_hora))
    passadas.sort((a, b) => b.data_hora.localeCompare(a.data_hora))
    return { hoje, proximas, passadas }
  }, [visitas, today])

  const agendadas = visitas.filter((v) => v.status === 'Agendado').length

  function openNew() {
    reset({
      titulo: '',
      tipo: 'Visita',
      data_hora: '',
      duracao_min: 60,
      local: '',
      obra_id: null,
      lead_id: null,
      status: 'Agendado',
      notas: '',
    })
    setEditingVisita(null)
    setShowForm(true)
  }

  function openEditVisita(v: Visita) {
    const localDt = new Date(v.data_hora)
    const dtStr = `${localDt.getFullYear()}-${String(localDt.getMonth() + 1).padStart(2, '0')}-${String(localDt.getDate()).padStart(2, '0')}T${String(localDt.getHours()).padStart(2, '0')}:${String(localDt.getMinutes()).padStart(2, '0')}`
    reset({
      titulo: v.titulo,
      tipo: v.tipo,
      data_hora: dtStr,
      duracao_min: v.duracao_min,
      local: v.local || '',
      obra_id: v.obra_id || null,
      lead_id: v.lead_id || null,
      status: v.status,
      notas: v.notas || '',
    })
    setEditingVisita(v)
    setShowForm(true)
  }

  async function onSubmit(data: CreateVisitaDTO) {
    const payload = {
      titulo: data.titulo,
      tipo: data.tipo,
      data_hora: new Date(data.data_hora).toISOString(),
      duracao_min: data.duracao_min ?? 60,
      local: data.local || null,
      obra_id: data.obra_id || null,
      lead_id: data.lead_id || null,
      status: data.status,
      notas: data.notas || null,
    }

    let ok: boolean
    if (editingVisita) {
      ok = await updateMutation.mutate(payload, editingVisita.id)
    } else {
      ok = await createMutation.mutate(payload)
    }

    if (ok) {
      setShowForm(false)
      setEditingVisita(null)
    }
  }

  async function deleteVisita(id: string) {
    const ok = await confirm({ title: 'Excluir visita?', description: 'Essa ação não pode ser desfeita.', confirmLabel: 'Excluir', variant: 'danger' })
    if (!ok) return
    await deleteMutation.mutate(undefined, id)
  }

  function renderGroup(title: string, items: Visita[]) {
    if (items.length === 0) return null
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">{title}</h3>
        <div className="space-y-2">
          {items.map((v) => (
            <div key={v.id} className="glass-card rounded-2xl p-4 group hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${TIPO_VISITA_COLORS[v.tipo] || TIPO_VISITA_COLORS.Outro}`}>{v.tipo}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${VISITA_STATUS_COLORS[v.status] || VISITA_STATUS_COLORS.Agendado}`}>{v.status}</span>
                  </div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">{v.titulo}</h4>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditVisita(v)} className="md:opacity-0 md:group-hover:opacity-100 p-1 text-gray-400 hover:text-sand-600 transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteVisita(v.id)} className="md:opacity-0 md:group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDateTime(v.data_hora)}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{v.duracao_min}min</span>
                {(v.obras?.nome || v.leads?.nome || v.local) && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{v.obras?.nome || v.leads?.nome || v.local}</span>
                )}
              </div>

              {v.notas && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{v.notas}</p>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} space-y-5`}>
      <PageHeader
        title="Agenda"
        subtitle={`${agendadas} visitas agendadas`}
        actions={
          <QuickActionBar
            actions={[{
              label: 'Nova Visita',
              icon: <Plus className="h-4 w-4" />,
              onClick: openNew,
              tone: 'warning',
            }]}
          />
        }
      />

      {featureFlags.architectAgenda && agendaTasks.length > 0 && (
        <SectionCard className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Prioridades Operacionais</h3>
            <span className="text-[11px] text-gray-500">{agendaTasks.length} tarefas</span>
          </div>
          <div className="space-y-1.5">
            {agendaTasks.slice(0, 6).map((task) => (
              <div key={task.code} className="flex items-center justify-between rounded-xl bg-white/70 dark:bg-gray-900/40 p-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{task.title}</p>
                  <p className="text-[11px] text-gray-500">{task.dueAt ? fmtDateTime(task.dueAt) : 'Sem prazo definido'}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  task.severity === 'high'
                    ? 'bg-red-100 text-red-700'
                    : task.severity === 'medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                }`}>
                  {task.severity}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {visitas.length === 0 ? (
        <EmptyStateAction
          icon={<CalendarDays className="h-5 w-5 text-sand-600" />}
          title="Nenhuma visita agendada"
          description="Agende visitas a obras e leads para manter o pipeline ativo."
          actionLabel="Agendar Visita"
          onAction={openNew}
        />
      ) : (
        <>
          {renderGroup('Hoje', grouped.hoje)}
          {renderGroup('Próximas', grouped.proximas)}
          {renderGroup('Anteriores', grouped.passadas)}
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editingVisita ? 'Editar Visita' : 'Nova Visita'}</h3>
              <button onClick={() => { setShowForm(false); setEditingVisita(null) }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <FormField error={errors.titulo} required>
                <FormInput registration={register('titulo')} hasError={!!errors.titulo} placeholder="Título *" />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField error={errors.tipo}>
                  <FormSelect registration={register('tipo')} hasError={!!errors.tipo}>
                    <option value="Visita">Visita</option>
                    <option value="Reunião">Reunião</option>
                    <option value="Vistoria">Vistoria</option>
                    <option value="Entrega">Entrega</option>
                    <option value="Outro">Outro</option>
                  </FormSelect>
                </FormField>
                <FormField error={errors.status}>
                  <FormSelect registration={register('status')} hasError={!!errors.status}>
                    <option value="Agendado">Agendado</option>
                    <option value="Realizado">Realizado</option>
                    <option value="Cancelado">Cancelado</option>
                    <option value="Reagendado">Reagendado</option>
                  </FormSelect>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField error={errors.data_hora} required>
                  <FormInput registration={register('data_hora')} hasError={!!errors.data_hora} type="datetime-local" />
                </FormField>
                <FormField error={errors.duracao_min}>
                  <FormInput registration={register('duracao_min', { valueAsNumber: true })} hasError={!!errors.duracao_min} type="number" placeholder="Duração (min)" />
                </FormField>
              </div>

              <FormField error={errors.local}>
                <FormInput registration={register('local')} hasError={!!errors.local} placeholder="Local" />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField error={errors.obra_id}>
                  <FormSelect registration={register('obra_id', { setValueAs: (v: string) => v || null })} hasError={!!errors.obra_id}>
                    <option value="">Obra (opcional)</option>
                    {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </FormSelect>
                </FormField>
                <FormField error={errors.lead_id}>
                  <FormSelect registration={register('lead_id', { setValueAs: (v: string) => v || null })} hasError={!!errors.lead_id}>
                    <option value="">Lead (opcional)</option>
                    {leads.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </FormSelect>
                </FormField>
              </div>

              <FormField error={errors.notas}>
                <FormTextarea registration={register('notas')} hasError={!!errors.notas} placeholder="Notas" rows={3} />
              </FormField>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingVisita(null) }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button type="submit" disabled={createMutation.isMutating || updateMutation.isMutating} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm disabled:opacity-50">{editingVisita ? 'Salvar' : 'Agendar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  )
}
