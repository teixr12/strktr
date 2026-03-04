import { notFound } from 'next/navigation'
import { ConstructionDocsDocumentContent } from '@/components/construction-docs/document-content'
import { isConstructionDocsEnabled } from '@/lib/construction-docs/feature'

export const dynamic = 'force-dynamic'

export default async function ConstructionDocsDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  if (!isConstructionDocsEnabled()) {
    notFound()
  }

  const { documentId } = await params
  return <ConstructionDocsDocumentContent documentId={documentId} />
}
