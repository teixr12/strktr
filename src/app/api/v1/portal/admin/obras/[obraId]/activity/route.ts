import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withPortalAdminV2Auth } from '@/lib/portal-admin-v2/api'
import { getPortalAdminObraActivity } from '@/server/services/portal-admin/obra-activity-service'

function resolveObraId(request: Request): string | null {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  const obrasIndex = segments.findIndex((segment) => segment === 'obras')
  return obrasIndex >= 0 ? segments[obrasIndex + 1]?.trim() || null : null
}

export const GET = withPortalAdminV2Auth('can_manage_projects', async (request, { supabase, orgId }) => {
  const obraId = resolveObraId(request)
  if (!obraId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'obraId inválido' }, 400)
  }

  const { data: obra, error: obraError } = await supabase
    .from('obras')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', obraId)
    .maybeSingle()

  if (obraError) {
    throw new Error(obraError.message)
  }
  if (!obra) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const payload = await getPortalAdminObraActivity({
    supabase,
    orgId,
    obraId,
  })

  return ok(request, payload)
})
