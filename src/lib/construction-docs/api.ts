import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail } from '@/lib/api/response'
import { isConstructionDocsEnabled } from '@/lib/construction-docs/feature'
import type { DomainPermission } from '@/lib/auth/domain-permissions'
import { withApiAuth, type AuthContext } from '@/lib/api/with-auth'

export function getConstructionDocsFlagMeta() {
  return {
    flag: 'FEATURE_CONSTRUCTION_DOCS',
  }
}

export function requireConstructionDocsEnabled(request: Request): Response | null {
  if (isConstructionDocsEnabled()) return null
  return fail(
    request,
    {
      code: API_ERROR_CODES.NOT_FOUND,
      message: 'Recurso não encontrado',
    },
    404
  )
}

export function withConstructionDocsAuth(
  permission: DomainPermission | null,
  handler: (request: Request, ctx: AuthContext) => Promise<Response>
) {
  return async (request: Request) => {
    const gate = requireConstructionDocsEnabled(request)
    if (gate) return gate
    const authHandler = withApiAuth(permission, handler)
    return authHandler(request)
  }
}
