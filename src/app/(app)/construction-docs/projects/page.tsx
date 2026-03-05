import { notFound } from 'next/navigation'
import { ConstructionDocsProjectsIndexContent } from '@/components/construction-docs/projects-index-content'
import { isConstructionDocsEnabled } from '@/lib/construction-docs/feature'

export const dynamic = 'force-dynamic'

export default function ConstructionDocsProjectsPage() {
  if (!isConstructionDocsEnabled()) {
    notFound()
  }

  return <ConstructionDocsProjectsIndexContent />
}
