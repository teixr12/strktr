import { notFound } from 'next/navigation'
import { BigDataOverviewContent } from '@/components/big-data/big-data-overview-content'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { createClient } from '@/lib/supabase/server'
import { isBigDataV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'

export const dynamic = 'force-dynamic'

export default async function BigDataPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isBigDataV1EnabledForOrg(orgId)) {
    notFound()
  }

  return <BigDataOverviewContent />
}
