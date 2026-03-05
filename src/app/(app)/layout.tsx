import { AppLayoutClient } from '@/components/layout/app-layout-client'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { createClient } from '@/lib/supabase/server'
import { isDocsWorkspaceEnabledForOrg } from '@/server/feature-flags/wave2-canary'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)
  const docsWorkspaceEnabled = isDocsWorkspaceEnabledForOrg(orgId)

  return (
    <AppLayoutClient docsWorkspaceEnabled={docsWorkspaceEnabled}>
      {children}
    </AppLayoutClient>
  )
}
