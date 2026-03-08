import { notFound } from 'next/navigation'
import { OpenBankingOverviewContent } from '@/components/open-banking/open-banking-overview-content'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { createClient } from '@/lib/supabase/server'
import { isOpenBankingV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'

export const dynamic = 'force-dynamic'

export default async function OpenBankingPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isOpenBankingV1EnabledForOrg(orgId)) {
    notFound()
  }

  return <OpenBankingOverviewContent />
}
