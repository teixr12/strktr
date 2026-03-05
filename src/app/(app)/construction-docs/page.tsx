import { notFound, redirect } from 'next/navigation'
import { isConstructionDocsEnabled } from '@/lib/construction-docs/feature'

export const dynamic = 'force-dynamic'

export default function ConstructionDocsHomePage() {
  if (!isConstructionDocsEnabled()) {
    notFound()
  }

  redirect('/construction-docs/projects')
}
