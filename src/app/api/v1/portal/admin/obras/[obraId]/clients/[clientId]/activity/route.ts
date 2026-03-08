import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withPortalAdminV2Auth } from '@/lib/portal-admin-v2/api'
import { getPortalAdminClientActivity } from '@/server/services/portal-admin/client-activity-service'

function resolveIds(request: Request): { obraId: string | null; clientId: string | null } {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  const obrasIndex = segments.findIndex((segment) => segment === 'obras')
  const clientsIndex = segments.findIndex((segment) => segment === 'clients')
  return {
    obraId: obrasIndex >= 0 ? segments[obrasIndex + 1]?.trim() || null : null,
    clientId: clientsIndex >= 0 ? segments[clientsIndex + 1]?.trim() || null : null,
  }
}

export const GET = withPortalAdminV2Auth('can_manage_projects', async (request, { supabase, orgId }) => {
  const { obraId, clientId } = resolveIds(request)
  if (!obraId || !clientId) {
    return fail(
      request,
      { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'obraId ou clientId inválido' },
      400
    )
  }

  const payload = await getPortalAdminClientActivity({
    supabase,
    orgId,
    obraId,
    clientId,
  })

  if (!payload) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Cliente do portal não encontrado' }, 404)
  }

  return ok(request, payload)
})
