'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { apiRequest } from '@/lib/api/client'
import { toast } from '@/hooks/use-toast'
import { fmtDateTime } from '@/lib/utils'
import { TIPO_VISITA_COLORS, VISITA_STATUS_COLORS } from '@/lib/constants'
import { Plus, X, Trash2, CalendarDays, Clock, MapPin, Pencil } from 'lucide-react'
import { featureFlags } from '@/lib/feature-flags'
import { PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import type { Visita, VisitaTipo, VisitaStatus, Lead, Obra } from '@/types/database'
import type { AgendaTask } from '@/shared/types/cronograma'

interface Props { initialVisitas: Visita[] }

export function CalendarioContent({ initialVisitas }: Props) {
  const supabase = createClient()
  const [visitas, setVisitas] = useState(initialVisitas)
  const [showForm, setShowForm] = useState(false)
  const [editingVisita, setEditingVisita] = useState<Visita | null>(null)
  const [obras, setObras] = useState<Pick<Obra, 'id' | 'nome'>[]>([])
  const [leads, setLeads] = useState<Pick<Lead, 'id' | 'nome'>[]>([])
  const [agendaTasks, setAgendaTasks] = useState<AgendaTask[]>([])

  const [form, setForm] = useState({
    titulo: '', tipo: 'Visita' as VisitaTipo,
    data_hora: '', duracao_min: '60', local: '',
    obra_id: '', lead_id: '', status: 'Agendado' as VisitaStatus,
    notas: '',
  })

  useEffect(() => {
    async function load() {
      const [o, l] = await Promise.all([
        supabase.from('obras').select('id, nome').order('nome'),
        supabase.from('leads').select('id, nome').order('nome'),
      ])
      if (o.data) setObras(o.data)
      if (l.data) setLeads(l.data)
    }
    load()
  }, [supabase])

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

  function resetForm() {
    setForm({ titulo: '', tipo: 'Visita', data_hora: '', duracao_min: '60', local: '', obra_id: '', lead_id: '', status: 'Agendado', notas: '' })
    setEditingVisita(null)
  }

  function openEditVisita(v: Visita) {
    setEditingVisita(v)
    const localDt = new Date(v.data_hora)
    const dtStr = `${localDt.getFullYear()}-${String(localDt.getMonth() + 1).padStart(2, '0')}-${String(localDt.getDate()).padStart(2, '0')}T${String(localDt.getHours()).padStart(2, '0')}:${String(localDt.getMinutes()).padStart(2, '0')}`
    setForm({
      titulo: v.titulo, tipo: v.tipo, data_hora: dtStr,
      duracao_min: String(v.duracao_min), local: v.local || '',
      obra_id: v.obra_id || '', lead_id: v.lead_id || '',
      status: v.status, notas: v.notas || '',
    })
    setShowForm(true)
  }

  async function saveVisita() {
    if (!form.titulo.trim()) { toast('Título é obrigatório', 'error'); return }
    if (!form.data_hora) { toast('Data/hora é obrigatória', 'error'); return }
    const payload = {
      titulo: form.titulo.trim(), tipo: form.tipo,
      data_hora: new Date(form.data_hora).toISOString(),
      duracao_min: parseInt(form.duracao_min) || 60,
      local: form.local || null,
      obra_id: form.obra_id || null, lead_id: form.lead_id || null,
      status: form.status, notas: form.notas || null,
    }

    try {
      if (editingVisita) {
        const data = await apiRequest<Visita>(`/api/v1/visitas/${editingVisita.id}`, {
          method: 'PUT',
          body: payload,
        })
        setVisitas((prev) => prev.map((vi) => vi.id === editingVisita.id ? data : vi))
        toast('Visita atualizada!', 'success')
      } else {
        const data = await apiRequest<Visita>('/api/v1/visitas', {
          method: 'POST',
          body: payload,
        })
        setVisitas((prev) => [...prev, data])
        toast('Visita agendada!', 'success')
      }
      setShowForm(false)
      resetForm()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar visita', 'error')
    }
  }

  async function deleteVisita(id: string) {
    if (!confirm('Excluir esta visita?')) return
    try {
      await apiRequest<{ success: boolean }>(`/api/v1/visitas/${id}`, { method: 'DELETE' })
      setVisitas((prev) => prev.filter((v) => v.id !== id))
      toast('Visita excluída', 'info')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao excluir visita', 'error')
    }
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
                  <button onClick={() => openEditVisita(v)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-sand-600 transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteVisita(v.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all">
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
    <div className="tailadmin-page space-y-5">
      <PageHeader
        title="Agenda"
        subtitle={`${agendadas} visitas agendadas`}
        actions={
          <QuickActionBar
            actions={[{
              label: 'Nova Visita',
              icon: <Plus className="h-4 w-4" />,
              onClick: () => {
                resetForm()
                setShowForm(true)
              },
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
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><CalendarDays className="w-7 h-7 text-gray-400" /></div>
          <p className="text-sm text-gray-500">Nenhuma visita agendada</p>
        </div>
      ) : (
        <>
          {renderGroup('Hoje', grouped.hoje)}
          {renderGroup('Próximas', grouped.proximas)}
          {renderGroup('Anteriores', grouped.passadas)}
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full max-w-md rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editingVisita ? 'Editar Visita' : 'Nova Visita'}</h3>
              <button onClick={() => { setShowForm(false); resetForm() }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Título *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />

              <div className="grid grid-cols-2 gap-3">
                <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as VisitaTipo }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="Visita">Visita</option>
                  <option value="Reunião">Reunião</option>
                  <option value="Vistoria">Vistoria</option>
                  <option value="Entrega">Entrega</option>
                  <option value="Outro">Outro</option>
                </select>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VisitaStatus }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="Agendado">Agendado</option>
                  <option value="Realizado">Realizado</option>
                  <option value="Cancelado">Cancelado</option>
                  <option value="Reagendado">Reagendado</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input value={form.data_hora} onChange={(e) => setForm((f) => ({ ...f, data_hora: e.target.value }))} type="datetime-local" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white" />
                <input value={form.duracao_min} onChange={(e) => setForm((f) => ({ ...f, duracao_min: e.target.value }))} type="number" placeholder="Duração (min)" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
              </div>

              <input value={form.local} onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))} placeholder="Local" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />

              <div className="grid grid-cols-2 gap-3">
                <select value={form.obra_id} onChange={(e) => setForm((f) => ({ ...f, obra_id: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="">Obra (opcional)</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
                <select value={form.lead_id} onChange={(e) => setForm((f) => ({ ...f, lead_id: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="">Lead (opcional)</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>

              <textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Notas" rows={3} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white resize-none" />

              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowForm(false); resetForm() }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button onClick={saveVisita} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm">{editingVisita ? 'Salvar' : 'Agendar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
