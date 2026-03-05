import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail } from '@/lib/api/response'
import { withApiAuth, type AuthContext } from '@/lib/api/with-auth'
import type { DomainPermission } from '@/lib/auth/domain-permissions'
import { isFinanceReceiptsEnabled } from '@/lib/finance-receipts/feature'

export function requireFinanceReceiptsEnabled(request: Request): Response | null {
  if (isFinanceReceiptsEnabled()) return null
  return fail(
    request,
    {
      code: API_ERROR_CODES.NOT_FOUND,
      message: 'Recurso não encontrado',
    },
    404
  )
}

export function withFinanceReceiptsAuth(
  permission: DomainPermission | null,
  handler: (request: Request, ctx: AuthContext) => Promise<Response>
) {
  return async (request: Request) => {
    const gate = requireFinanceReceiptsEnabled(request)
    if (gate) return gate
    const authHandler = withApiAuth(permission, handler)
    return authHandler(request)
  }
}
