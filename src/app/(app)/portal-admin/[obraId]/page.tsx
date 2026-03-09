import { notFound } from 'next/navigation'
import { PortalAdminObraContent } from '@/components/portal-admin/portal-admin-obra-content'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { createClient } from '@/lib/supabase/server'
import { isPortalAdminV2EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { getPortalAdminObraActivity } from '@/server/services/portal-admin/obra-activity-service'
import { getPortalAdminObraOverview } from '@/server/services/portal-admin/obra-overview-service'

export const dynamic = 'force-dynamic'

export default async function PortalAdminObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isPortalAdminV2EnabledForOrg(orgId)) {
    notFound()
  }

  const [obraRes, overview, activity] = await Promise.all([
    supabase
      .from('obras')
      .select('id, nome, cliente, status')
      .eq('org_id', orgId)
      .eq('id', obraId)
      .maybeSingle(),
    getPortalAdminObraOverview({
      supabase,
      orgId,
      obraId,
    }),
    getPortalAdminObraActivity({
      supabase,
      orgId,
      obraId,
    }),
  ])

  const obra = obraRes.data

  if (!obra) {
    notFound()
  }

  return <PortalAdminObraContent obra={obra} overview={overview} activity={activity} />
}
