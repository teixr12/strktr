import { notFound } from 'next/navigation'
import { PortalAdminProjetoContent } from '@/components/portal-admin/portal-admin-projeto-content'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { createClient } from '@/lib/supabase/server'
import { isPortalAdminV2EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { getPortalAdminProjectOverview } from '@/server/services/portal-admin/project-overview-service'

export const dynamic = 'force-dynamic'

export default async function PortalAdminProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isPortalAdminV2EnabledForOrg(orgId)) {
    notFound()
  }

  const payload = await getPortalAdminProjectOverview({
    supabase,
    orgId,
    projectId,
  })

  if (!payload) {
    notFound()
  }

  return <PortalAdminProjetoContent payload={payload} />
}
