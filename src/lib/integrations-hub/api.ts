import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail } from '@/lib/api/response'
import { withApiAuth, type AuthContext } from '@/lib/api/with-auth'
import type { DomainPermission } from '@/lib/auth/domain-permissions'
import { isIntegrationsHubEnabled } from '@/lib/integrations-hub/feature'
import { isIntegrationsHubV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'

export function requireIntegrationsHubEnabled(request: Request): Response | null {
  if (isIntegrationsHubEnabled()) return null
  return fail(
    request,
    {
      code: API_ERROR_CODES.NOT_FOUND,
      message: 'Recurso não encontrado',
    },
    404
  )
}

export function withIntegrationsHubAuth(
  permission: DomainPermission | null,
  handler: (request: Request, ctx: AuthContext) => Promise<Response>
) {
  return async (request: Request) => {
    const gate = requireIntegrationsHubEnabled(request)
    if (gate) return gate
    const authHandler = withApiAuth(permission, async (innerRequest, ctx) => {
      if (!isIntegrationsHubV1EnabledForOrg(ctx.orgId)) {
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
