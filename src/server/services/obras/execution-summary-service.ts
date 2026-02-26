import type {
  ExecutionAlert,
  ExecutionSeverity,
  RecommendedAction,
} from '@/shared/types/execution'

type EtapaRecord = { status: string }
type ChecklistItemRecord = { concluido: boolean; data_limite: string | null }
type ChecklistRecord = { checklist_items?: ChecklistItemRecord[] | null }
type TransacaoRecord = { tipo: string; valor: number | null }

export type ExecutionSummaryPayload = {
  kpis: {
    etapasTotal: number
    etapasConcluidas: number
    etapasBloqueadas: number
    checklistTotal: number
    checklistPendentes: number
    checklistAtrasados: number
    receitas: number
    despesas: number
    saldo: number
  }
  risk: {
    score: number
    level: ExecutionSeverity
  }
  alerts: ExecutionAlert[]
  recommendedActions: RecommendedAction[]
}

function getRiskLevel(score: number): ExecutionSeverity {
  if (score >= 65) return 'high'
  if (score >= 35) return 'medium'
  return 'low'
}

function isOverdue(date: string | null): boolean {
  if (!date) return false
  return new Date(date) < new Date()
}

function hasDiaryGap(lastDiaryDate: string | null): boolean {
  if (!lastDiaryDate) return true
  const diffMs = Date.now() - new Date(lastDiaryDate).getTime()
  return diffMs > 1000 * 60 * 60 * 48
}

export function buildExecutionSummary(params: {
  etapas: EtapaRecord[]
  checklists: ChecklistRecord[]
  transacoes: TransacaoRecord[]
  lastDiaryDate: string | null
}): ExecutionSummaryPayload {
  const { etapas, checklists, transacoes, lastDiaryDate } = params

  const etapasTotal = etapas.length
  const etapasConcluidas = etapas.filter((e) => e.status === 'Concluída').length
  const etapasBloqueadas = etapas.filter((e) => e.status === 'Bloqueada').length
  const etapasEmAndamento = etapas.filter((e) => e.status === 'Em Andamento').length

  const checklistItems = checklists.flatMap((checklist) => checklist.checklist_items || [])
  const checklistTotal = checklistItems.length
  const checklistPendentes = checklistItems.filter((item) => !item.concluido).length
  const checklistAtrasados = checklistItems.filter(
    (item) => !item.concluido && isOverdue(item.data_limite)
  ).length

  const receitas = transacoes
    .filter((tx) => tx.tipo === 'Receita')
    .reduce((sum, tx) => sum + (tx.valor || 0), 0)
  const despesas = transacoes
    .filter((tx) => tx.tipo === 'Despesa')
    .reduce((sum, tx) => sum + (tx.valor || 0), 0)
  const saldo = receitas - despesas

  let riskScore = 0
  riskScore += etapasBloqueadas * 25
  riskScore += checklistAtrasados * 15
  riskScore += checklistPendentes > 0 ? 10 : 0
  riskScore += etapasTotal > 0 && etapasEmAndamento === 0 && etapasConcluidas < etapasTotal ? 20 : 0
  riskScore = Math.min(100, riskScore)

  const riskLevel = getRiskLevel(riskScore)

  const alerts: ExecutionAlert[] = []
  if (etapasBloqueadas > 0) {
    alerts.push({
      code: 'BLOCKED_STAGE',
      title: `${etapasBloqueadas} etapa(s) bloqueada(s)`,
      severity: 'high',
    })
  }
  if (checklistAtrasados > 0) {
    alerts.push({
      code: 'OVERDUE_CHECKLIST',
      title: `${checklistAtrasados} item(ns) de checklist atrasado(s)`,
      severity: 'medium',
    })
  }
  if (riskScore >= 65) {
    alerts.push({
      code: 'HIGH_RISK',
      title: 'Risco operacional alto',
      severity: 'high',
    })
  }

  const recommendedActions: RecommendedAction[] = []
  if (etapasBloqueadas > 0) {
    recommendedActions.push({
      code: 'RESOLVE_BLOCKED_STAGE',
      title: 'Resolver etapas bloqueadas para destravar o cronograma',
      cta: 'Ir para Etapas',
      severity: 'high',
      targetTab: 'etapas',
    })
  }
  if (checklistAtrasados > 0) {
    recommendedActions.push({
      code: 'HANDLE_OVERDUE_CHECKLIST',
      title: 'Priorizar itens de checklist atrasados hoje',
      cta: 'Ver Checklists',
      severity: 'high',
      targetTab: 'checklists',
    })
  }
  if (etapasTotal > 0 && etapasEmAndamento === 0 && etapasConcluidas < etapasTotal) {
    recommendedActions.push({
      code: 'START_STAGE_PROGRESS',
      title: 'Definir uma etapa em andamento para manter ritmo da obra',
      cta: 'Atualizar Etapas',
      severity: 'medium',
      targetTab: 'etapas',
    })
  }
  if (hasDiaryGap(lastDiaryDate)) {
    recommendedActions.push({
      code: 'ADD_DAILY_NOTE',
      title: 'Registrar atualização no diário para manter histórico auditável',
      cta: 'Adicionar Nota',
      severity: 'medium',
      targetTab: 'diario',
    })
  }
  if (riskScore >= 35) {
    recommendedActions.push({
      code: 'RECALCULATE_RISK',
      title: 'Recalcular risco após ajustes para confirmar melhora',
      cta: 'Recalcular Risco',
      severity: riskScore >= 65 ? 'high' : 'medium',
      targetTab: 'resumo',
    })
  }

  return {
    kpis: {
      etapasTotal,
      etapasConcluidas,
      etapasBloqueadas,
      checklistTotal,
      checklistPendentes,
      checklistAtrasados,
      receitas,
      despesas,
      saldo,
    },
    risk: {
      score: riskScore,
      level: riskLevel,
    },
    alerts,
    recommendedActions: recommendedActions.slice(0, 3),
  }
}
