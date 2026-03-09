import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withPortalAdminV2Auth } from '@/lib/portal-admin-v2/api'
import { getPortalAdminProjectOverview } from '@/server/services/portal-admin/project-overview-service'

function resolveProjectId(request: Request): string | null {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  const projectsIndex = segments.findIndex((segment) => segment === 'projects')
  return projectsIndex >= 0 ? segments[projectsIndex + 1]?.trim() || null : null
}

export const GET = withPortalAdminV2Auth('can_manage_projects', async (request, { supabase, orgId }) => {
  const projectId = resolveProjectId(request)
  if (!projectId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'projectId inválido' }, 400)
  }

  const payload = await getPortalAdminProjectOverview({
    supabase,
    orgId,
    projectId,
  })

  if (!payload) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Projeto não encontrado' }, 404)
  }

  return ok(request, payload)
})
