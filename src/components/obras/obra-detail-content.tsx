'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { fmt, fmtDate } from '@/lib/utils'
import { OBRA_STATUS_COLORS } from '@/lib/constants'
import { ArrowLeft, Edit2, Trash2, Plus, CheckCircle, Loader, Circle, XCircle, AlertTriangle } from 'lucide-react'
import { ObraFormModal } from './obra-form-modal'
import { DiarioObraTab } from './diario-obra'
import { ObraChecklistsTab } from './obra-checklists'
import { ObraCronogramaTab } from './obra-cronograma'
import { apiRequest } from '@/lib/api/client'
import { track } from '@/lib/analytics/client'
import { featureFlags } from '@/lib/feature-flags'
import type { Obra, ObraEtapa, Transacao, DiarioObra as DiarioEntry, ObraChecklist } from '@/types/database'
import { createEtapaSchema, type CreateEtapaDTO } from '@/shared/schemas/execution'
import type { ExecutionAlert, RecommendedAction } from '@/shared/types/execution'

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

type ExecutionSummary = {
  kpis: {
    etapasTotal: number
    etapasConcluidas: number
    etapasBloqueadas: number
    checklistPendentes: number
    checklistAtrasados: number
  }
  risk: {
    score: number
    level: 'low' | 'medium' | 'high'
  }
  alerts: ExecutionAlert[]
  recommendedActions: RecommendedAction[]
}

export function ObraDetailContent({ obra, initialEtapas, initialTransacoes, initialDiario = [], initialChecklists = [] }: Props) {
  const useV2 = featureFlags.uiTailadminV1 && featureFlags.uiV2ObraTabs
  const router = useRouter()
  const [tab, setTab] = useState<'resumo' | 'etapas' | 'cronograma' | 'financeiro' | 'diario' | 'checklists'>('resumo')
  const [etapas, setEtapas] = useState(initialEtapas)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showEtapaForm, setShowEtapaForm] = useState(false)
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const etapaForm = useForm<CreateEtapaDTO>({
    resolver: zodResolver(createEtapaSchema),
    defaultValues: { nome: '', responsavel: '', status: 'Pendente' },
  })

  const txObra = initialTransacoes
  const rec = txObra.filter((t) => t.tipo === 'Receita').reduce((s, t) => s + t.valor, 0)
  const dep = txObra.filter((t) => t.tipo === 'Despesa').reduce((s, t) => s + t.valor, 0)
  const riskEnabled = featureFlags.executionRiskEngine

  const alertStyles: Record<ExecutionAlert['severity'], string> = {
    high: 'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-blue-50 text-blue-700 border-blue-200',
  }

  const actionStyles: Record<RecommendedAction['severity'], string> = {
    high: 'border-red-200 bg-red-50/70',
    medium: 'border-amber-200 bg-amber-50/70',
    low: 'border-blue-200 bg-blue-50/70',
  }

  const loadExecutionSummary = useCallback(async () => {
    setLoadingSummary(true)
    setSummaryError(null)
    try {
      const data = await apiRequest<ExecutionSummary>(`/api/v1/obras/${obra.id}/execution-summary`)
      setExecutionSummary(data)
    } catch (err) {
      setExecutionSummary(null)
      setSummaryError(err instanceof Error ? err.message : 'Falha ao carregar painel de execução')
    } finally {
      setLoadingSummary(false)
    }
  }, [obra.id])

  async function recalculateRisk() {
    try {
      await apiRequest(`/api/v1/obras/${obra.id}/risks/recalculate`, { method: 'POST' })
      toast('Risco recalculado', 'success')
      track('RiskRecalculated', {
        source: 'obras',
        entity_type: 'obra',
        entity_id: obra.id,
        outcome: 'success',
      }).catch(() => undefined)
      loadExecutionSummary()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao recalcular risco'
      toast(message, 'error')
    }
  }

  useEffect(() => {
    loadExecutionSummary()
  }, [loadExecutionSummary])

  async function refreshEtapas() {
    try {
      const data = await apiRequest<ObraEtapa[]>(`/api/v1/obras/${obra.id}/etapas`)
      setEtapas(data || [])
      loadExecutionSummary()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar etapas'
      toast(message, 'error')
    }
  }

  async function updateEtapaStatus(id: string, status: string) {
    try {
      await apiRequest(`/api/v1/obras/${obra.id}/etapas/${id}/status`, {
        method: 'POST',
        body: { status },
      })
      toast('Etapa atualizada!', 'success')
      track('EtapaStatusChanged', {
        source: 'obras',
        entity_type: 'obra_etapa',
        entity_id: id,
        outcome: 'success',
        to_status: status,
      }).catch(() => undefined)
      refreshEtapas()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar etapa'
      toast(message, 'error')
    }
  }

  async function deleteEtapa(id: string) {
    if (!confirm('Excluir esta etapa?')) return
    try {
      await apiRequest(`/api/v1/obras/${obra.id}/etapas/${id}`, { method: 'DELETE' })
      toast('Etapa excluída', 'info')
      refreshEtapas()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir etapa'
      toast(message, 'error')
    }
  }

  async function saveEtapa(values: CreateEtapaDTO) {
    try {
      await apiRequest(`/api/v1/obras/${obra.id}/etapas`, {
        method: 'POST',
        body: values,
      })
      toast('Etapa adicionada!', 'success')
      setShowEtapaForm(false)
      etapaForm.reset({ nome: '', responsavel: '', status: 'Pendente' })
      refreshEtapas()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar etapa'
      toast(message, 'error')
    }
  }

  async function runRecommendedAction(action: RecommendedAction) {
    if (action.code === 'RECALCULATE_RISK') {
      await recalculateRisk()
      return
    }
    setTab(action.targetTab)
  }

  const actionNow = executionSummary?.recommendedActions?.[0] || null
  const actionNowDescriptionByCode: Record<RecommendedAction['code'], string> = {
    RESOLVE_BLOCKED_STAGE: 'Existem etapas bloqueadas impactando o cronograma.',
    HANDLE_OVERDUE_CHECKLIST: 'Existem checklists vencidos exigindo ação imediata.',
    START_STAGE_PROGRESS: 'Existem etapas sem progresso registrado recentemente.',
    ADD_DAILY_NOTE: 'O diário está desatualizado e pode causar perda de contexto.',
    RECALCULATE_RISK: 'Recalcule o risco para atualizar decisões operacionais.',
  }
  const financeiroSaldo = rec - dep

  async function handleDelete() {
    if (!confirm('Excluir esta obra? Esta ação não pode ser desfeita.')) return
    try {
      await apiRequest(`/api/v1/obras/${obra.id}`, { method: 'DELETE' })
      toast('Obra excluída', 'info')
      router.push('/obras')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir obra'
      toast(message, 'error')
    }
  }

  const tabs = [
    { id: 'resumo' as const, label: 'Resumo' },
    { id: 'etapas' as const, label: 'Etapas' },
    { id: 'cronograma' as const, label: 'Cronograma' },
    { id: 'financeiro' as const, label: 'Financeiro' },
    { id: 'diario' as const, label: 'Diario' },
    { id: 'checklists' as const, label: 'Checklists' },
  ]

  return (
    <div className={`${useV2 ? 'tailadmin-page' : 'p-4 md:p-6'} mx-auto max-w-5xl`}>
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

      <div className="mb-4 grid gap-3 xl:grid-cols-5">
        {loadingSummary ? (
          <>
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
            <div className="skeleton h-24 rounded-2xl" />
          </>
        ) : summaryError ? (
          <div className="xl:col-span-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-red-700">{summaryError}</p>
              <button
                type="button"
                onClick={() => void loadExecutionSummary()}
                className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="glass-card rounded-2xl p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Etapas</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {executionSummary ? `${executionSummary.kpis.etapasConcluidas}/${executionSummary.kpis.etapasTotal}` : `${etapas.filter((e) => e.status === 'Concluída').length}/${etapas.length}`}
              </p>
              <p className="text-xs text-gray-500">Concluídas</p>
            </div>
            <div className="glass-card rounded-2xl p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Risco</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {executionSummary ? executionSummary.risk.level.toUpperCase() : '—'}
              </p>
              <p className="text-xs text-gray-500">Score {executionSummary ? executionSummary.risk.score : '—'}</p>
            </div>
            <div className="glass-card rounded-2xl p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Checklists</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {executionSummary ? executionSummary.kpis.checklistPendentes : initialChecklists.length}
              </p>
              <p className="text-xs text-gray-500">Pendentes</p>
            </div>
            <div className="glass-card rounded-2xl p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Financeiro</p>
              <p className={`mt-1 text-lg font-semibold ${financeiroSaldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmt(financeiroSaldo)}
              </p>
              <p className="text-xs text-gray-500">Recebido - gasto</p>
            </div>
            <div className="glass-card rounded-2xl p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">Ação Agora</p>
              {actionNow ? (
                <>
                  <p className="mt-1 text-xs font-semibold text-gray-900 dark:text-white">{actionNow.title}</p>
                  <button
                    onClick={() => void runRecommendedAction(actionNow)}
                    className="mt-2 rounded-lg bg-sand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sand-600"
                  >
                    {actionNow.cta}
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-xs text-gray-500">Sem ação crítica no momento.</p>
                  <button
                    onClick={() => setTab('diario')}
                    className="mt-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                  >
                    Registrar atualização
                  </button>
                </>
              )}
            </div>
          </>
        )}
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
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-xs text-gray-500">Status</span><p className="mt-1"><span className={`px-2 py-0.5 text-xs font-bold rounded-full ${OBRA_STATUS_COLORS[obra.status]}`}>{obra.status}</span></p></div>
              <div><span className="text-xs text-gray-500">Tipo</span><p className="font-semibold text-sm mt-1">{obra.tipo}</p></div>
              <div><span className="text-xs text-gray-500">Contrato</span><p className="font-semibold text-sm mt-1">{fmt(obra.valor_contrato)}</p></div>
              <div><span className="text-xs text-gray-500">Área</span><p className="font-semibold text-sm mt-1">{obra.area_m2 ? `${obra.area_m2}m²` : '—'}</p></div>
              <div><span className="text-xs text-gray-500">Início</span><p className="font-semibold text-sm mt-1">{fmtDate(obra.data_inicio)}</p></div>
              <div><span className="text-xs text-gray-500">Previsão</span><p className="font-semibold text-sm mt-1">{fmtDate(obra.data_previsao)}</p></div>
            </div>

            <div className="pt-3 border-t border-gray-200/50 dark:border-gray-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-gray-500">Risco Operacional</span>
                  {loadingSummary ? (
                    <p className="text-sm text-gray-500 mt-1">Calculando...</p>
                  ) : executionSummary ? (
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {executionSummary.risk.level.toUpperCase()} ({executionSummary.risk.score})
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">Indisponível</p>
                  )}
                </div>
                {riskEnabled && (
                  <button
                    onClick={recalculateRisk}
                    className="px-3 py-1.5 bg-sand-500 hover:bg-sand-600 text-white text-xs font-medium rounded-full transition-all btn-press"
                  >
                    Recalcular risco
                  </button>
                )}
              </div>
              {executionSummary && (
                <p className="text-xs text-gray-500 mt-2">
                  Bloqueios: {executionSummary.kpis.etapasBloqueadas} · Pendentes: {executionSummary.kpis.checklistPendentes} · Atrasados: {executionSummary.kpis.checklistAtrasados}
                </p>
              )}
            </div>

            {obra.descricao && <div className="pt-3 border-t border-gray-200/50 dark:border-gray-800"><span className="text-xs text-gray-500">Descrição</span><p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-line">{obra.descricao}</p></div>}
          </div>

          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Centro de Execução</h3>
              <span className="text-[11px] text-gray-500">Ações recomendadas hoje</span>
            </div>

            {!executionSummary?.alerts?.length ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-xs text-emerald-700">Sem alertas críticos no momento.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {executionSummary.alerts.map((alert) => (
                  <div key={alert.code} className={`rounded-xl border px-3 py-2 text-xs font-medium flex items-center gap-2 ${alertStyles[alert.severity]}`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {alert.title}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {executionSummary?.recommendedActions?.length ? (
                executionSummary.recommendedActions.map((action) => (
                  <div key={action.code} className={`rounded-xl border p-3 ${actionStyles[action.severity]}`}>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">{action.title}</p>
                    <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">{actionNowDescriptionByCode[action.code]}</p>
                    <button
                      onClick={() => runRecommendedAction(action)}
                      className="mt-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white text-xs rounded-lg transition-all"
                    >
                      {action.cta}
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500">Sem recomendações pendentes para hoje.</p>
              )}
            </div>

            <div className="pt-2 border-t border-gray-200/50 dark:border-gray-800 space-y-2">
              <p className="text-xs text-gray-500">Timeline recente</p>
              {initialDiario.length === 0 ? (
                <button
                  onClick={() => setTab('diario')}
                  className="text-xs text-sand-600 hover:text-sand-700 transition-colors"
                >
                  Registrar primeira nota no diário
                </button>
              ) : (
                initialDiario.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="text-xs text-gray-600 dark:text-gray-300">
                    {fmtDate(entry.created_at)} · {entry.titulo}
                  </div>
                ))
              )}
            </div>

            {etapas.length === 0 && (
              <button onClick={() => setTab('etapas')} className="text-xs text-sand-600 hover:text-sand-700">
                Crie sua primeira etapa
              </button>
            )}
            {initialChecklists.length === 0 && (
              <button onClick={() => setTab('checklists')} className="block text-xs text-sand-600 hover:text-sand-700">
                Adicione checklist base
              </button>
            )}
          </div>
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
                <form className="space-y-3" onSubmit={etapaForm.handleSubmit(saveEtapa)}>
                  <input {...etapaForm.register('nome')} placeholder="Nome da etapa *" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
                  {etapaForm.formState.errors.nome && <p className="text-xs text-red-500">{etapaForm.formState.errors.nome.message}</p>}
                  <input {...etapaForm.register('responsavel')} placeholder="Responsável" className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none dark:text-white" />
                  <select {...etapaForm.register('status')} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm dark:text-white">
                    <option>Pendente</option><option>Em Andamento</option><option>Concluída</option><option>Bloqueada</option>
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowEtapaForm(false)} className="flex-1 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all">Cancelar</button>
                    <button type="submit" className="flex-1 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-2xl btn-press transition-all">Adicionar</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Financeiro */}
      {tab === 'cronograma' && (
        <ObraCronogramaTab obraId={obra.id} />
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
        <DiarioObraTab obraId={obra.id} initialEntries={initialDiario} onEntryCreated={loadExecutionSummary} />
      )}

      {/* Checklists */}
      {tab === 'checklists' && (
        <ObraChecklistsTab obraId={obra.id} initialChecklists={initialChecklists} onChecklistChanged={loadExecutionSummary} />
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
