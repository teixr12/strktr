'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { fmt, fmtDate } from '@/lib/utils'
import { OBRA_STATUS_COLORS } from '@/lib/constants'
import { ArrowLeft, Edit2, Trash2, Plus, CheckCircle, Loader, Circle, XCircle } from 'lucide-react'
import { ObraFormModal } from './obra-form-modal'
import { DiarioObraTab } from './diario-obra'
import { ObraChecklistsTab } from './obra-checklists'
import { logDiario } from '@/lib/diario'
import type { Obra, ObraEtapa, Transacao, DiarioObra as DiarioEntry, ObraChecklist } from '@/types/database'

const etapaStatusInfo: Record<string, { c: string; Icon: React.ComponentType<{ className?: string }> }> = {
  Concluída: { c: 'text-emerald-600', Icon: CheckCircle },
  'Em Andamento': { c: 'text-amber-600', Icon: Loader },
  Pendente: { c: 'text-gray-400', Icon: Circle },
  Bloqueada: { c: 'text-red-500', Icon: XCircle },
}

interface Props {
  obra: Obra
  initialEtapas: ObraEtapa[]
  initialTransacoes: Transacao[]
  initialDiario?: DiarioEntry[]
  initialChecklists?: ObraChecklist[]
}

export function ObraDetailContent({ obra, initialEtapas, initialTransacoes, initialDiario = [], initialChecklists = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'resumo' | 'etapas' | 'financeiro' | 'diario' | 'checklists'>('resumo')
  const [etapas, setEtapas] = useState(initialEtapas)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showEtapaForm, setShowEtapaForm] = useState(false)
  const [etapaForm, setEtapaForm] = useState({ nome: '', responsavel: '', status: 'Pendente' })

  const txObra = initialTransacoes
  const rec = txObra.filter((t) => t.tipo === 'Receita').reduce((s, t) => s + t.valor, 0)
  const dep = txObra.filter((t) => t.tipo === 'Despesa').reduce((s, t) => s + t.valor, 0)

  async function refreshEtapas() {
    const { data } = await supabase.from('obra_etapas').select('*').eq('obra_id', obra.id).order('ordem')
    if (data) setEtapas(data)
  }

  async function updateEtapaStatus(id: string, status: string) {
    const { error } = await supabase.from('obra_etapas').update({ status }).eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Etapa atualizada!', 'success')
    refreshEtapas()
    // Log to diario
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const etapa = etapas.find((e) => e.id === id)
      logDiario(supabase, obra.id, user.id, 'etapa_change', `Etapa "${etapa?.nome}" → ${status}`)
    }
  }

  async function deleteEtapa(id: string) {
    if (!confirm('Excluir esta etapa?')) return
    await supabase.from('obra_etapas').delete().eq('id', id)
    toast('Etapa excluída', 'info')
    refreshEtapas()
  }

  async function saveEtapa() {
    if (!etapaForm.nome) { toast('Preencha o nome da etapa', 'error'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('obra_etapas').insert({
      obra_id: obra.id,
      user_id: user.id,
      nome: etapaForm.nome,
      responsavel: etapaForm.responsavel || null,
      status: etapaForm.status,
    })
    if (error) { toast(error.message, 'error'); return }
    toast('Etapa adicionada!', 'success')
    setShowEtapaForm(false)
    setEtapaForm({ nome: '', responsavel: '', status: 'Pendente' })
    refreshEtapas()
  }

  async function handleDelete() {
    if (!confirm('Excluir esta obra? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase.from('obras').delete().eq('id', obra.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Obra excluída', 'info')
    router.push('/obras')
  }

  const tabs = [
    { id: 'resumo' as const, label: 'Resumo' },
    { id: 'etapas' as const, label: 'Etapas' },
    { id: 'financeiro' as const, label: 'Financeiro' },
    { id: 'diario' as const, label: 'Diario' },
    { id: 'checklists' as const, label: 'Checklists' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <button onClick={() => router.push('/obras')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{obra.nome}</h2>
          <p className="text-sm text-gray-500">{obra.cliente} · {obra.local}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEditForm(true)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-400">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-500 text-xs">Progresso</span>
          <span className="font-semibold text-sand-600 dark:text-sand-400 text-xs">{obra.progresso || 0}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-sand-400 to-sand-600 rounded-full transition-all duration-1000" style={{ width: `${obra.progresso || 0}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200/50 dark:border-gray-800 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 text-sm font-medium transition-colors ${tab === t.id ? 'text-sand-600 dark:text-sand-400 border-b-2 border-sand-500' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Resumo */}
      {tab === 'resumo' && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-xs text-gray-500">Status</span><p className="mt-1"><span className={`px-2 py-0.5 text-xs font-bold rounded-full ${OBRA_STATUS_COLORS[obra.status]}`}>{obra.status}</span></p></div>
            <div><span className="text-xs text-gray-500">Tipo</span><p className="font-semibold text-sm mt-1">{obra.tipo}</p></div>
            <div><span className="text-xs text-gray-500">Contrato</span><p className="font-semibold text-sm mt-1">{fmt(obra.valor_contrato)}</p></div>
            <div><span className="text-xs text-gray-500">Área</span><p className="font-semibold text-sm mt-1">{obra.area_m2 ? `${obra.area_m2}m²` : '—'}</p></div>
            <div><span className="text-xs text-gray-500">Início</span><p className="font-semibold text-sm mt-1">{fmtDate(obra.data_inicio)}</p></div>
            <div><span className="text-xs text-gray-500">Previsão</span><p className="font-semibold text-sm mt-1">{fmtDate(obra.data_previsao)}</p></div>
          </div>
          {obra.descricao && <div className="pt-3 border-t border-gray-200/50 dark:border-gray-800"><span className="text-xs text-gray-500">Descrição</span><p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-line">{obra.descricao}</p></div>}
        </div>
      )}

      {/* Etapas */}
      {tab === 'etapas' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowEtapaForm(true)} className="flex items-center gap-2 px-3 py-1.5 bg-sand-500 hover:bg-sand-600 text-white text-xs font-medium rounded-full transition-all btn-press">
              <Plus className="w-3.5 h-3.5" /> Nova Etapa
            </button>
          </div>
          {etapas.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhuma etapa cadastrada</p>
          ) : (
            etapas.map((e) => {
              const s = etapaStatusInfo[e.status] || etapaStatusInfo.Pendente
              return (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 mb-2 group">
                  <div className={`${s.c} flex-shrink-0`}><s.Icon className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{e.nome}</p>
                    {e.responsavel && <p className="text-xs text-gray-500">{e.responsavel}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <select value={e.status} onChange={(ev) => updateEtapaStatus(e.id, ev.target.value)} className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 cursor-pointer">
                      {['Pendente', 'Em Andamento', 'Concluída', 'Bloqueada'].map((s2) => (
                        <option key={s2} value={s2}>{s2}</option>
                      ))}
                    </select>
                    <button onClick={() => deleteEtapa(e.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}

          {/* Etapa Form Inline Modal */}
          {showEtapaForm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="modal-glass modal-animate w-full max-w-sm rounded-3xl shadow-2xl dark:bg-gray-900 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Nova Etapa</h3>
                <div className="space-y-3">
                  <input value={etapaForm.nome} onChange={(e) => setEtapaForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome da etapa *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
                  <input value={etapaForm.responsavel} onChange={(e) => setEtapaForm((f) => ({ ...f, responsavel: e.target.value }))} placeholder="Responsável" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
                  <select value={etapaForm.status} onChange={(e) => setEtapaForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                    <option>Pendente</option><option>Em Andamento</option><option>Concluída</option><option>Bloqueada</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => setShowEtapaForm(false)} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                    <button onClick={saveEtapa} className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all">Adicionar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financeiro */}
      {tab === 'financeiro' && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Contrato</p>
              <p className="font-bold text-sm text-gray-900 dark:text-white">{fmt(obra.valor_contrato)}</p>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Recebido</p>
              <p className="font-bold text-sm text-emerald-600">{fmt(rec)}</p>
            </div>
            <div className="glass-card rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Gasto</p>
              <p className="font-bold text-sm text-red-500">{fmt(dep)}</p>
            </div>
          </div>
          {txObra.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Nenhuma transação</p>
          ) : (
            txObra.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/50 dark:bg-gray-800/50 mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${t.tipo === 'Receita' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    <div className={`w-3 h-3 rounded-full ${t.tipo === 'Receita' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{t.descricao}</p>
                    <p className="text-[10px] text-gray-400">{fmtDate(t.data)} · {t.categoria}</p>
                  </div>
                </div>
                <span className={`font-semibold text-sm ${t.tipo === 'Receita' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {t.tipo === 'Receita' ? '+' : '-'}{fmt(t.valor)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Diario */}
      {tab === 'diario' && (
        <DiarioObraTab obraId={obra.id} initialEntries={initialDiario} />
      )}

      {/* Checklists */}
      {tab === 'checklists' && (
        <ObraChecklistsTab obraId={obra.id} initialChecklists={initialChecklists} />
      )}

      {showEditForm && (
        <ObraFormModal
          obra={obra}
          onClose={() => setShowEditForm(false)}
          onSaved={() => { setShowEditForm(false); router.refresh() }}
        />
      )}
    </div>
  )
}
