'use client'

import { useState, useMemo } from 'react'
import { apiRequest } from '@/lib/api/client'
import { toast } from '@/hooks/use-toast'
import { fmt, fmtDate } from '@/lib/utils'
import { PROJETO_STATUS_COLORS } from '@/lib/constants'
import { Plus, Search, FolderKanban, ArrowRight, X } from 'lucide-react'
import { EmptyStateAction, PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import type { Projeto, ProjetoStatus } from '@/types/database'

const STATUS_OPTIONS: ProjetoStatus[] = ['Planejamento', 'Em Aprovação', 'Aprovado', 'Em Execução', 'Concluído', 'Arquivado']
const TIPO_OPTIONS = ['Residencial', 'Comercial', 'Industrial', 'Reforma', 'Infraestrutura', 'Outro']

interface Props {
  initialProjetos: Projeto[]
  leads: { id: string; nome: string }[]
}

export function ProjetosContent({ initialProjetos, leads }: Props) {
  const [projetos, setProjetos] = useState(initialProjetos)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Projeto | null>(null)
  const [form, setForm] = useState({
    nome: '', descricao: '', cliente: '', local: '', tipo: 'Residencial',
    status: 'Planejamento' as ProjetoStatus, valor_estimado: '',
    area_m2: '', lead_id: '', data_inicio_prev: '', data_fim_prev: '', notas: '',
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

  async function refresh() {
    try {
      const data = await apiRequest<Projeto[]>('/api/v1/projetos?limit=200')
      setProjetos(data)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao recarregar projetos', 'error')
    }
  }

  function openForm(p?: Projeto) {
    if (p) {
      setEditing(p)
      setForm({
        nome: p.nome, descricao: p.descricao || '', cliente: p.cliente || '',
        local: p.local || '', tipo: p.tipo, status: p.status,
        valor_estimado: String(p.valor_estimado || ''), area_m2: String(p.area_m2 || ''),
        lead_id: p.lead_id || '', data_inicio_prev: p.data_inicio_prev || '',
        data_fim_prev: p.data_fim_prev || '', notas: p.notas || '',
      })
    } else {
      setEditing(null)
      setForm({ nome: '', descricao: '', cliente: '', local: '', tipo: 'Residencial', status: 'Planejamento', valor_estimado: '', area_m2: '', lead_id: '', data_inicio_prev: '', data_fim_prev: '', notas: '' })
    }
    setShowForm(true)
  }

  async function save() {
    if (!form.nome.trim()) { toast('Nome e obrigatorio', 'error'); return }
    const payload = {
      nome: form.nome.trim(), descricao: form.descricao || null,
      cliente: form.cliente || null, local: form.local || null,
      tipo: form.tipo, status: form.status,
      valor_estimado: parseFloat(form.valor_estimado) || 0,
      area_m2: parseFloat(form.area_m2) || null,
      lead_id: form.lead_id || null,
      data_inicio_prev: form.data_inicio_prev || null,
      data_fim_prev: form.data_fim_prev || null,
      notas: form.notas || null,
    }

    try {
      if (editing) {
        await apiRequest<Projeto>(`/api/v1/projetos/${editing.id}`, { method: 'PUT', body: payload })
        toast('Projeto atualizado!', 'success')
      } else {
        await apiRequest<Projeto>('/api/v1/projetos', { method: 'POST', body: payload })
        toast('Projeto criado!', 'success')
      }
      setShowForm(false)
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar projeto', 'error')
    }
  }

  async function convertToObra(p: Projeto) {
    if (!confirm(`Converter "${p.nome}" em Obra?`)) return
    try {
      await apiRequest<{ obra: { id: string } }>(`/api/v1/projetos/${p.id}/convert-to-obra`, { method: 'POST' })
      toast('Obra criada a partir do projeto!', 'success')
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao converter projeto', 'error')
    }
  }

  async function deleteProjeto(id: string) {
    if (!confirm('Excluir este projeto?')) return
    try {
      await apiRequest<{ success: boolean }>(`/api/v1/projetos/${id}`, { method: 'DELETE' })
      toast('Projeto excluido', 'info')
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao excluir projeto', 'error')
    }
  }

  return (
    <div className="tailadmin-page space-y-4">
      <PageHeader
        title="Projetos"
        subtitle={`${projetos.length} projetos no workspace`}
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
          Todos ({projetos.length})
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${statusFilter === s ? 'bg-sand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {s} ({projetos.filter((p) => p.status === s).length})
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
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        </SectionCard>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full max-w-lg rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editing ? 'Editar Projeto' : 'Novo Projeto'}
            </h3>
            <div className="space-y-3">
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome do projeto *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} placeholder="Cliente" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
                <input value={form.local} onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))} placeholder="Local" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  {TIPO_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjetoStatus }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.valor_estimado} onChange={(e) => setForm((f) => ({ ...f, valor_estimado: e.target.value }))} placeholder="Valor estimado (R$)" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
                <input type="number" value={form.area_m2} onChange={(e) => setForm((f) => ({ ...f, area_m2: e.target.value }))} placeholder="Area (m2)" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Inicio previsto</label>
                  <input type="date" value={form.data_inicio_prev} onChange={(e) => setForm((f) => ({ ...f, data_inicio_prev: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fim previsto</label>
                  <input type="date" value={form.data_fim_prev} onChange={(e) => setForm((f) => ({ ...f, data_fim_prev: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white" />
                </div>
              </div>
              {leads.length > 0 && (
                <select value={form.lead_id} onChange={(e) => setForm((f) => ({ ...f, lead_id: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="">Vincular a lead (opcional)</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              )}
              <textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Notas" rows={2} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button onClick={save} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all">{editing ? 'Salvar' : 'Criar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
