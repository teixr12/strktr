import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { isPublicApiV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { PublicApiOverviewContent } from '@/components/public-api/public-api-overview-content'

export const dynamic = 'force-dynamic'

export default async function PublicApiPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isPublicApiV1EnabledForOrg(orgId)) {
    notFound()
  }

  return <PublicApiOverviewContent />
}
