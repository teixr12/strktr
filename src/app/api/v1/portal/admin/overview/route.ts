import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { ok } from '@/lib/api/response'
import { withPortalAdminV2Auth } from '@/lib/portal-admin-v2/api'
import { listPortalAdminOverview } from '@/server/services/portal-admin/overview-service'

export const GET = withPortalAdminV2Auth('can_manage_projects', async (request, { supabase, orgId }) => {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('q')
  const { page, pageSize } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 24,
    maxPageSize: 50,
  })

  const result = await listPortalAdminOverview({
    supabase,
    orgId,
    page,
    pageSize,
    search,
  })

  return ok(request, result.items, {
    ...buildPaginationMeta(result.items.length, result.total, page, pageSize),
    summary: result.summary,
  })
})
