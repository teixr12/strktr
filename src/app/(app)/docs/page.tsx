import { notFound } from 'next/navigation'
import { DocsWorkspaceContent } from '@/components/docs/docs-workspace-content'
import { isDocsWorkspaceEnabled } from '@/lib/docs-workspace/feature'

export const dynamic = 'force-dynamic'

export default function DocsWorkspacePage() {
  if (!isDocsWorkspaceEnabled()) {
    notFound()
  }

  return <DocsWorkspaceContent />
}
