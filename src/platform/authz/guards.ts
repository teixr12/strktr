import type { UserRole } from '@/types/database'
import type { DomainPermission } from '@/lib/auth/domain-permissions'
import { hasDomainPermission, requireDomainPermission } from '@/lib/auth/domain-permissions'

export function can(role: UserRole | null | undefined, permission: DomainPermission) {
  return hasDomainPermission(role, permission)
}

export function requirePermission(
  request: Request,
  role: UserRole | null | undefined,
  permission: DomainPermission
) {
  return requireDomainPermission(request, role, permission)
}

export function requireTenantScope(requestOrgId: string | null | undefined) {
  return Boolean(requestOrgId)
}
