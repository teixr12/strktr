import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { isReferralV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { IndicacoesContent } from '@/components/indicacoes/indicacoes-content'

export const dynamic = 'force-dynamic'

export default async function IndicacoesPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isReferralV1EnabledForOrg(orgId)) {
    notFound()
  }

  return <IndicacoesContent />
}
