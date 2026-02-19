'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { X } from 'lucide-react'
import type { Obra } from '@/types/database'

interface ObraFormModalProps {
  obra?: Obra | null
  onClose: () => void
  onSaved: () => void
}

export function ObraFormModal({ obra, onClose, onSaved }: ObraFormModalProps) {
  const isEdit = !!obra
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nome: obra?.nome || '',
    cliente: obra?.cliente || '',
    local: obra?.local || '',
    tipo: obra?.tipo || 'Residencial',
    valor_contrato: obra?.valor_contrato || 0,
    area_m2: obra?.area_m2 || '',
    progresso: obra?.progresso || 0,
    status: obra?.status || 'Em Andamento',
    etapa_atual: obra?.etapa_atual || '',
    data_inicio: obra?.data_inicio || '',
    data_previsao: obra?.data_previsao || '',
    descricao: obra?.descricao || '',
  })

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!form.nome || !form.cliente || !form.local) {
      toast('Preencha nome, cliente e local', 'error')
      return
    }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast('Sessão expirada', 'error'); return }

    const payload = {
      user_id: user.id,
      nome: form.nome,
      cliente: form.cliente,
      local: form.local,
      tipo: form.tipo,
      valor_contrato: Number(form.valor_contrato) || 0,
      area_m2: form.area_m2 ? Number(form.area_m2) : null,
      progresso: Number(form.progresso) || 0,
      status: form.status,
      etapa_atual: form.etapa_atual || null,
      data_inicio: form.data_inicio || null,
      data_previsao: form.data_previsao || null,
      descricao: form.descricao || null,
    }

    let error
    if (isEdit && obra) {
      const res = await supabase.from('obras').update(payload).eq('id', obra.id)
      error = res.error
    } else {
      const res = await supabase.from('obras').insert(payload)
      error = res.error
    }

    setLoading(false)
    if (error) {
      toast(error.message, 'error')
      return
    }
    toast(isEdit ? 'Obra atualizada!' : 'Obra criada!', 'success')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
      <div className="modal-glass modal-animate w-full md:max-w-lg rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-900">
        <div className="p-5 border-b border-gray-200/50 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Editar Obra' : 'Nova Obra'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <input value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome da obra *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.cliente} onChange={(e) => set('cliente', e.target.value)} placeholder="Cliente *" className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white" />
            <input value={form.local} onChange={(e) => set('local', e.target.value)} placeholder="Local *" className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sand-500/50 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)} className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white">
              <option>Residencial</option><option>Comercial</option><option>Industrial</option><option>Rural</option><option>Reforma</option>
            </select>
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white">
              <option>Em Andamento</option><option>Orçamento</option><option>Pausada</option><option>Concluída</option><option>Cancelada</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
              <input type="number" value={form.valor_contrato || ''} onChange={(e) => set('valor_contrato', e.target.value)} placeholder="Valor contrato" className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
            </div>
            <input type="number" value={form.area_m2 || ''} onChange={(e) => set('area_m2', e.target.value)} placeholder="Área m²" className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.etapa_atual} onChange={(e) => set('etapa_atual', e.target.value)} placeholder="Etapa atual (ex: Fundação)" className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Progresso: {form.progresso}%</label>
              <input type="range" min="0" max="100" value={form.progresso} onChange={(e) => set('progresso', Number(e.target.value))} className="w-full accent-sand-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data Início</label>
              <input type="date" value={form.data_inicio} onChange={(e) => set('data_inicio', e.target.value)} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Previsão Conclusão</label>
              <input type="date" value={form.data_previsao} onChange={(e) => set('data_previsao', e.target.value)} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
            </div>
          </div>
          <textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Descrição / observações" rows={3} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none resize-none dark:text-white" />
          <button onClick={handleSave} disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-sand-500 to-sand-700 hover:from-sand-600 hover:to-sand-800 text-white font-medium rounded-2xl btn-press transition-all shadow-lg shadow-sand-500/25 disabled:opacity-60">
            {loading ? 'Salvando...' : 'Salvar Obra'}
          </button>
        </div>
      </div>
    </div>
  )
}
