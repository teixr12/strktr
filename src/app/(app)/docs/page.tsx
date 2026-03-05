import { notFound } from 'next/navigation'
import { DocsWorkspaceContent } from '@/components/docs/docs-workspace-content'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { createClient } from '@/lib/supabase/server'
import { isDocsWorkspaceEnabledForOrg } from '@/server/feature-flags/wave2-canary'

export const dynamic = 'force-dynamic'

export default async function DocsWorkspacePage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!isDocsWorkspaceEnabledForOrg(orgId)) {
    notFound()
  }

  return <DocsWorkspaceContent />
}
