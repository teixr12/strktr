'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { fmt } from '@/lib/utils'
import { Plus, X, Trash2, Edit2, Search, BookOpen, Tag } from 'lucide-react'
import type { KnowledgebaseItem, KBCategoria } from '@/types/database'

const KB_CATEGORIA_COLORS: Record<string, string> = {
  material: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  mao_de_obra: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  equipamento: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  sop: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  referencia: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const KB_CATEGORIA_LABELS: Record<string, string> = {
  material: 'Material',
  mao_de_obra: 'Mão de Obra',
  equipamento: 'Equipamento',
  sop: 'SOP / Procedimento',
  referencia: 'Referência',
}

interface Props { initialItems: KnowledgebaseItem[] }

export function KnowledgebaseContent({ initialItems }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<KnowledgebaseItem | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('Todos')

  const [form, setForm] = useState({
    titulo: '', conteudo: '', categoria: 'material' as KBCategoria,
    unidade: '', valor_referencia: '', tags: '',
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

  function resetForm() {
    setForm({ titulo: '', conteudo: '', categoria: 'material', unidade: '', valor_referencia: '', tags: '' })
  }

  function openNew() { resetForm(); setEditItem(null); setShowForm(true) }

  function openEdit(item: KnowledgebaseItem) {
    setForm({
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

  async function saveItem() {
    if (!form.titulo.trim()) { toast('Título é obrigatório', 'error'); return }
    const payload = {
      titulo: form.titulo.trim(),
      conteudo: form.conteudo || null,
      categoria: form.categoria,
      unidade: form.unidade || null,
      valor_referencia: form.valor_referencia ? parseFloat(form.valor_referencia) : null,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    }

    if (editItem) {
      const { error } = await supabase.from('knowledgebase').update(payload).eq('id', editItem.id)
      if (error) { toast(error.message, 'error'); return }
      setItems((prev) => prev.map((i) => i.id === editItem.id ? { ...i, ...payload } as KnowledgebaseItem : i))
      toast('Item atualizado!', 'success')
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('knowledgebase').insert({ ...payload, user_id: user.id }).select().single()
      if (error) { toast(error.message, 'error'); return }
      setItems((prev) => [...prev, data])
      toast('Item adicionado!', 'success')
    }
    setShowForm(false)
    setEditItem(null)
  }

  async function deleteItem(id: string) {
    if (!confirm('Excluir este item?')) return
    const { error } = await supabase.from('knowledgebase').update({ ativo: false }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    setItems((prev) => prev.filter((i) => i.id !== id))
    toast('Item excluído', 'info')
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Base de Conhecimento</h2>
          <p className="text-xs text-gray-500">{items.length} itens · SOPs, materiais e referências</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-sand-500 hover:bg-sand-600 text-white text-sm font-medium rounded-full transition-all btn-press">
          <Plus className="w-4 h-4" /> Novo Item
        </button>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título, conteúdo ou tags..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categorias.map((c) => (
            <button key={c} onClick={() => setFiltroCategoria(c)} className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${filtroCategoria === c ? 'bg-sand-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {c === 'Todos' ? 'Todos' : KB_CATEGORIA_LABELS[c] || c}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><BookOpen className="w-7 h-7 text-gray-400" /></div>
          <p className="text-sm text-gray-500">Nenhum item encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <div key={item.id} className="glass-card rounded-2xl p-4 group hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${KB_CATEGORIA_COLORS[item.categoria] || KB_CATEGORIA_COLORS.referencia}`}>
                  {KB_CATEGORIA_LABELS[item.categoria] || item.categoria}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="modal-glass modal-animate w-full max-w-md rounded-3xl shadow-2xl dark:bg-gray-900 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editItem ? 'Editar Item' : 'Novo Item'}</h3>
              <button onClick={() => { setShowForm(false); setEditItem(null) }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Título *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              <select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as KBCategoria }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                {Object.entries(KB_CATEGORIA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <textarea value={form.conteudo} onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))} placeholder="Conteúdo / Descrição" rows={3} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.unidade} onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))} placeholder="Unidade (m², kg, h)" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
                <input value={form.valor_referencia} onChange={(e) => setForm((f) => ({ ...f, valor_referencia: e.target.value }))} placeholder="Valor referência (R$)" type="number" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
              </div>
              <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="Tags (separar por vírgula)" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:text-white" />
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowForm(false); setEditItem(null) }} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                <button onClick={saveItem} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all text-sm">
                  {editItem ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
