import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { isAgentReadyV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { AgentReadyOverviewContent } from '@/components/agent-ready/agent-ready-overview-content'

export const dynamic = 'force-dynamic'

export default async function AgentReadyPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!orgId || !isAgentReadyV1EnabledForOrg(orgId)) {
    notFound()
  }

  return <AgentReadyOverviewContent />
}
