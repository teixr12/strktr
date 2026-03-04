import { notFound } from 'next/navigation'
import { ConstructionDocsPublicShareView } from '@/components/construction-docs/public-share-view'
import { isConstructionDocsEnabled } from '@/lib/construction-docs/feature'

export const dynamic = 'force-dynamic'

export default async function ConstructionDocsPublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  if (!isConstructionDocsEnabled()) {
    notFound()
  }

  const { token } = await params
  return <ConstructionDocsPublicShareView token={token} />
}
