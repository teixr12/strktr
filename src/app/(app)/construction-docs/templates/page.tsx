import { notFound } from 'next/navigation'
import { ConstructionDocsTemplatesContent } from '@/components/construction-docs/templates-content'
import { isConstructionDocsEnabled } from '@/lib/construction-docs/feature'

export const dynamic = 'force-dynamic'

export default function ConstructionDocsTemplatesPage() {
  if (!isConstructionDocsEnabled()) {
    notFound()
  }

  return <ConstructionDocsTemplatesContent />
}
