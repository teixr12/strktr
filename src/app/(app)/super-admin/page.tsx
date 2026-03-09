import { notFound } from 'next/navigation'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { createClient } from '@/lib/supabase/server'
import { SuperAdminOverviewContent } from '@/components/super-admin/super-admin-overview-content'
import { isSuperAdminV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'

export const dynamic = 'force-dynamic'

export default async function SuperAdminPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isSuperAdminV1EnabledForOrg(orgId)) {
    notFound()
  }

  return <SuperAdminOverviewContent />
}
