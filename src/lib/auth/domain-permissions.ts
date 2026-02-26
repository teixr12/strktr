import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail } from '@/lib/api/response'
import type { UserRole } from '@/types/database'

export type DomainPermission =
  | 'can_manage_leads'
  | 'can_manage_finance'
  | 'can_manage_projects'
  | 'can_manage_team'

const DOMAIN_PERMISSION_MATRIX: Record<DomainPermission, UserRole[]> = {
  can_manage_leads: ['admin', 'manager', 'user'],
  can_manage_finance: ['admin', 'manager'],
  can_manage_projects: ['admin', 'manager'],
  can_manage_team: ['admin', 'manager'],
}

const DOMAIN_PERMISSION_MESSAGES: Record<DomainPermission, string> = {
  can_manage_leads: 'Sem permissão para gerenciar leads',
  can_manage_finance: 'Sem permissão para gerenciar financeiro',
  can_manage_projects: 'Sem permissão para gerenciar projetos',
  can_manage_team: 'Sem permissão para gerenciar equipe/organização',
}

export function hasDomainPermission(
  role: UserRole | null | undefined,
  permission: DomainPermission
): boolean {
  if (!role) return false
  return DOMAIN_PERMISSION_MATRIX[permission].includes(role)
}

export function requireDomainPermission(
  request: Request,
  role: UserRole | null | undefined,
  permission: DomainPermission
) {
  if (hasDomainPermission(role, permission)) return null
  return fail(
    request,
    {
      code: API_ERROR_CODES.FORBIDDEN,
      message: DOMAIN_PERMISSION_MESSAGES[permission],
      details: { permission, role: role || null },
    },
    403
  )
}
