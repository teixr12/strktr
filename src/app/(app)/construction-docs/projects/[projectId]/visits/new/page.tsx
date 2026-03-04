import Link from 'next/link'
import { notFound } from 'next/navigation'
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

  return (
    <div className="tailadmin-page space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Fluxo Guiado de Visita</h1>
        <p className="mt-2 text-sm text-gray-500">
          O fluxo completo de criação já está disponível dentro da página do projeto. Use o botão abaixo para continuar.
        </p>
        <Link
          href={`/construction-docs/projects/${projectId}`}
          className="mt-4 inline-flex rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600"
        >
          Ir para o projeto
        </Link>
      </div>
    </div>
  )
}
