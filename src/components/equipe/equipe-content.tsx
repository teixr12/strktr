'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { fmt } from '@/lib/utils'
import { MEMBRO_STATUS_COLORS } from '@/lib/constants'
import { Plus, X, Trash2, Edit2, Search, Star, Phone, Mail } from 'lucide-react'
import type { Membro, MembroStatus } from '@/types/database'

interface Props { initialMembros: Membro[] }

export function EquipeContent({ initialMembros }: Props) {
  const supabase = createClient()
  const [membros, setMembros] = useState(initialMembros)
  const [showForm, setShowForm] = useState(false)
  const [editMembro, setEditMembro] = useState<Membro | null>(null)
  const [busca, setBusca] = useState('')

  const [form, setForm] = useState({
    nome: '', cargo: '', telefone: '', email: '',
    especialidade: '', status: 'Ativo' as MembroStatus,
    avaliacao: '5', valor_hora: '',
  })

  const ativos = membros.filter((m) => m.status === 'Ativo').length

  const filtered = useMemo(() => {
    if (!busca) return membros
    const q = busca.toLowerCase()
    return membros.filter((m) => m.nome.toLowerCase().includes(q) || m.cargo.toLowerCase().includes(q))
  }, [membros, busca])

  function resetForm() {
    setForm({ nome: '', cargo: '', telefone: '', email: '', especialidade: '', status: 'Ativo', avaliacao: '5', valor_hora: '' })
  }

  function openNew() { resetForm(); setEditMembro(null); setShowForm(true) }

  function openEdit(m: Membro) {
    setForm({
      nome: m.nome, cargo: m.cargo, telefone: m.telefone || '', email: m.email || '',
      especialidade: m.especialidade || '', status: m.status,
      avaliacao: String(m.avaliacao), valor_hora: m.valor_hora ? String(m.valor_hora) : '',
    })
    setEditMembro(m)
    setShowForm(true)
  }

  async function saveMembro() {
    if (!form.nome.trim()) { toast('Nome é obrigatório', 'error'); return }
    if (!form.cargo.trim()) { toast('Cargo é obrigatório', 'error'); return }
    const payload = {
      nome: form.nome.trim(), cargo: form.cargo.trim(),
      telefone: form.telefone || null, email: form.email || null,
      especialidade: form.especialidade || null, status: form.status,
      avaliacao: parseFloat(form.avaliacao) || 5,
      valor_hora: form.valor_hora ? parseFloat(form.valor_hora) : null,
    }

    if (editMembro) {
      const { error } = await supabase.from('equipe').update(payload).eq('id', editMembro.id)
      if (error) { toast(error.message, 'error'); return }
      setMembros((prev) => prev.map((m) => m.id === editMembro.id ? { ...m, ...payload } as Membro : m))
      toast('Membro atualizado!', 'success')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('equipe').insert({ ...payload, user_id: user.id }).select().single()
      if (error) { toast(error.message, 'error'); return }
      setMembros((prev) => [...prev, data])
      toast('Membro adicionado!', 'success')
    }
    setShowForm(false)
    setEditMembro(null)
  }

  async function deleteMembro(id: string) {
    if (!confirm('Excluir este membro da equipe?')) return
    const { error } = await supabase.from('equipe').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    setMembros((prev) => prev.filter((m) => m.id !== id))
    toast('Membro excluído', 'info')
  }

  function renderStars(rating: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-3 h-3 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
    ))
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Equipe</h2>
          <p className="text-xs text-gray-500">{membros.length} membros · {ativos} ativos</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-sand-500 hover:bg-sand-600 text-white text-sm font-medium rounded-full transition-all btn-press">
          <Plus className="w-4 h-4" /> Novo Membro
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><Search className="w-7 h-7 text-gray-400" /></div>
          <p className="text-sm text-gray-500">Nenhum membro encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => (
            <div key={m.id} className="glass-card rounded-2xl p-4 group hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <img
                    src={m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nome)}&background=d4a373&color=fff`}
                    alt={m.nome}
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
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full max-w-md rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editMembro ? 'Editar Membro' : 'Novo Membro'}</h3>
              <button onClick={() => { setShowForm(false); setEditMembro(null) }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              <input value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} placeholder="Cargo *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} placeholder="Telefone" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
                <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              </div>
              <input value={form.especialidade} onChange={(e) => setForm((f) => ({ ...f, especialidade: e.target.value }))} placeholder="Especialidade" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              <div className="grid grid-cols-3 gap-3">
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MembroStatus }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Férias">Férias</option>
                </select>
                <input value={form.avaliacao} onChange={(e) => setForm((f) => ({ ...f, avaliacao: e.target.value }))} placeholder="Avaliação" type="number" min="1" max="5" step="0.5" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
                <input value={form.valor_hora} onChange={(e) => setForm((f) => ({ ...f, valor_hora: e.target.value }))} placeholder="R$/h" type="number" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowForm(false); setEditMembro(null) }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button onClick={saveMembro} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm">
                  {editMembro ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
