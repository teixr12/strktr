import { notFound } from 'next/navigation'
import { ConstructionDocsVisitGuidedContent } from '@/components/construction-docs/visit-guided-content'
import { isConstructionDocsEnabled } from '@/lib/construction-docs/feature'

export const dynamic = 'force-dynamic'

export default async function ConstructionDocsNewVisitPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  if (!isConstructionDocsEnabled()) {
    notFound()
  }

  const { projectId } = await params

  return <ConstructionDocsVisitGuidedContent projectId={projectId} />
}
