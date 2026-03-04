import { notFound } from 'next/navigation'
import { ConstructionDocsVisitContent } from '@/components/construction-docs/visit-content'
import { isConstructionDocsEnabled } from '@/lib/construction-docs/feature'

export const dynamic = 'force-dynamic'

export default async function ConstructionDocsVisitPage({
  params,
}: {
  params: Promise<{ visitId: string }>
}) {
  if (!isConstructionDocsEnabled()) {
    notFound()
  }

  const { visitId } = await params
  return <ConstructionDocsVisitContent visitId={visitId} />
}
