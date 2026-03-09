import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { isBillingV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { BillingOverviewContent } from '@/components/billing/billing-overview-content'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isBillingV1EnabledForOrg(orgId)) {
    notFound()
  }

  return <BillingOverviewContent />
}
