import { notFound } from 'next/navigation'
import { ConstructionDocsProjectContent } from '@/components/construction-docs/project-content'
import { isConstructionDocsEnabled } from '@/lib/construction-docs/feature'

export const dynamic = 'force-dynamic'

export default async function ConstructionDocsProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  if (!isConstructionDocsEnabled()) {
    notFound()
  }

  const { projectId } = await params
  return <ConstructionDocsProjectContent projectId={projectId} />
}
