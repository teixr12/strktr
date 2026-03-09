import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { isPortalAdminV2EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { listPortalAdminOverview } from '@/server/services/portal-admin/overview-service'
import { PortalAdminOverviewContent } from '@/components/portal-admin/portal-admin-overview-content'

export const dynamic = 'force-dynamic'

export default async function PortalAdminPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isPortalAdminV2EnabledForOrg(orgId)) {
    notFound()
  }

  const result = await listPortalAdminOverview({
    supabase,
    orgId,
    page: 1,
    pageSize: 24,
  })

  return (
    <PortalAdminOverviewContent
      initialItems={result.items}
      initialSummary={result.summary}
      initialTotal={result.total}
    />
  )
}
