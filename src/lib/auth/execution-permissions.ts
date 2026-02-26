import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail } from '@/lib/api/response'
import type { UserRole } from '@/types/database'
import {
  hasExecutionPermission,
  type ExecutionPermission,
} from '@/shared/types/execution'

const EXECUTION_PERMISSION_MESSAGES: Record<ExecutionPermission, string> = {
  can_update_stage: 'Sem permissão para atualizar etapas da obra',
  can_toggle_checklist: 'Sem permissão para atualizar checklists da obra',
  can_add_diary: 'Sem permissão para adicionar notas no diário',
  can_recalculate_risk: 'Sem permissão para recalcular risco da obra',
}

export function requireExecutionPermission(
  request: Request,
  role: UserRole | null | undefined,
  permission: ExecutionPermission
) {
  if (hasExecutionPermission(role, permission)) return null
  return fail(
    request,
    {
      code: API_ERROR_CODES.FORBIDDEN,
      message: EXECUTION_PERMISSION_MESSAGES[permission],
      details: { permission, role: role || null },
    },
    403
  )
}

export function canManageExecutionStructure(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}
