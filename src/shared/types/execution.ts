import type { UserRole } from '@/types/database'

export type ExecutionPermission =
  | 'can_update_stage'
  | 'can_toggle_checklist'
  | 'can_add_diary'
  | 'can_recalculate_risk'

export type ExecutionSeverity = 'low' | 'medium' | 'high'

export type RecommendedActionCode =
  | 'RESOLVE_BLOCKED_STAGE'
  | 'HANDLE_OVERDUE_CHECKLIST'
  | 'START_STAGE_PROGRESS'
  | 'ADD_DAILY_NOTE'
  | 'RECALCULATE_RISK'

export type ExecutionTabTarget = 'resumo' | 'etapas' | 'checklists' | 'diario' | 'financeiro'

export interface RecommendedAction {
  code: RecommendedActionCode
  title: string
  cta: string
  severity: ExecutionSeverity
  targetTab: ExecutionTabTarget
}

export interface ExecutionAlert {
  code: string
  title: string
  severity: ExecutionSeverity
}

const EXECUTION_PERMISSION_MATRIX: Record<ExecutionPermission, UserRole[]> = {
  can_update_stage: ['admin', 'manager', 'user'],
  can_toggle_checklist: ['admin', 'manager', 'user'],
  can_add_diary: ['admin', 'manager', 'user'],
  can_recalculate_risk: ['admin', 'manager'],
}

export function hasExecutionPermission(
  role: UserRole | null | undefined,
  permission: ExecutionPermission
): boolean {
  if (!role) return false
  return EXECUTION_PERMISSION_MATRIX[permission].includes(role)
}
