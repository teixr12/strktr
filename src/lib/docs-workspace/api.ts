import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail } from '@/lib/api/response'
import { withApiAuth, type AuthContext } from '@/lib/api/with-auth'
import type { DomainPermission } from '@/lib/auth/domain-permissions'
import { isDocsWorkspaceEnabled } from '@/lib/docs-workspace/feature'
import { isDocsWorkspaceEnabledForOrg } from '@/server/feature-flags/wave2-canary'

export function requireDocsWorkspaceEnabled(request: Request): Response | null {
  if (isDocsWorkspaceEnabled()) return null
  return fail(
    request,
    {
      code: API_ERROR_CODES.NOT_FOUND,
      message: 'Recurso não encontrado',
    },
    404
  )
}

export function withDocsWorkspaceAuth(
  permission: DomainPermission | null,
  handler: (request: Request, ctx: AuthContext) => Promise<Response>
) {
  return async (request: Request) => {
    const gate = requireDocsWorkspaceEnabled(request)
    if (gate) return gate
    const authHandler = withApiAuth(permission, async (innerRequest, ctx) => {
      if (!isDocsWorkspaceEnabledForOrg(ctx.orgId)) {
        return fail(
          innerRequest,
          {
            code: API_ERROR_CODES.NOT_FOUND,
            message: 'Recurso não encontrado',
          },
          404
        )
      }
      return handler(innerRequest, ctx)
    })
    return authHandler(request)
  }
}
