import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { isIntegrationsHubV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { IntegracoesHubContent } from '@/components/integracoes/integracoes-hub-content'

export const dynamic = 'force-dynamic'

export default async function IntegracoesPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isIntegrationsHubV1EnabledForOrg(orgId)) {
    notFound()
  }

  return <IntegracoesHubContent />
}
