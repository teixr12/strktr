export type CronogramaItemTipo = 'tarefa' | 'marco'
export type CronogramaItemStatus = 'pendente' | 'em_andamento' | 'concluido' | 'bloqueado'
export type CronogramaDependenciaTipo = 'FS' | 'SS' | 'FF'

export interface CriticalPathSummary {
  totalItems: number
  delayedItems: number
  blockedItems: number
  criticalItemIds: string[]
  projectedEndDate: string | null
}

export interface AgendaTask {
  code: string
  title: string
  severity: 'high' | 'medium' | 'low'
  source: 'visita' | 'cronograma' | 'checklist'
  dueAt: string | null
  href: string
  meta?: Record<string, unknown>
}

export interface PortalSessionPayload {
  sessionId: string
  portalClienteId: string
  orgId: string
  obraId: string
  expiresAt: string
}
