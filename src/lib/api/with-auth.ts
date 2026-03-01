import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/types/database'
import type { DomainPermission } from '@/lib/auth/domain-permissions'
import { getApiUser } from './auth'
import { fail } from './response'
import { API_ERROR_CODES } from './errors'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'

export interface AuthContext {
  user: NonNullable<Awaited<ReturnType<typeof getApiUser>>['user']>
  supabase: SupabaseClient
  requestId: string
  orgId: string
  role: UserRole
  memberships: Awaited<ReturnType<typeof getApiUser>>['memberships']
}

/**
 * Wraps an API route handler with authentication and permission checks.
 * Eliminates repeated auth boilerplate across 15+ route files.
 */
export function withApiAuth(
  permission: DomainPermission,
  handler: (request: Request, ctx: AuthContext) => Promise<Response>
) {
  return async (request: Request, _routeCtx?: unknown) => {
    const { user, supabase, error, requestId, orgId, role, memberships } =
      await getApiUser(request)

    if (!user || !supabase) {
      return fail(
        request,
        { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
        401
      )
    }

    if (!orgId) {
      return fail(
        request,
        { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' },
        403
      )
    }

    const permissionError = requireDomainPermission(request, role, permission)
    if (permissionError) return permissionError

    return handler(request, {
      user,
      supabase,
      requestId,
      orgId,
      role: role as UserRole,
      memberships,
    })
  }
}
