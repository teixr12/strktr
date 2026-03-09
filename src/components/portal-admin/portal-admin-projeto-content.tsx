'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, FolderKanban, ShieldCheck } from 'lucide-react'
import { PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import type { PortalAdminProjectOverviewPayload } from '@/shared/types/portal-admin'
import { PortalAdminObraContent } from '@/components/portal-admin/portal-admin-obra-content'

interface Props {
  payload: PortalAdminProjectOverviewPayload
}

export function PortalAdminProjetoContent({ payload }: Props) {
  const { projeto, linkedObra, overview, activity } = payload

  if (!linkedObra || !overview || !activity) {
    return (
      <div className="tailadmin-page space-y-4">
        <PageHeader
          title={projeto.nome}
          subtitle={`${projeto.cliente || 'Sem cliente'} · ${projeto.status || 'Sem status'}`}
          statusLabel="Portal Admin V2"
          actions={
            <QuickActionBar
              actions={[
                {
                  label: 'Voltar ao overview',
                  icon: <ArrowLeft className="h-4 w-4" />,
                  href: '/portal-admin',
                },
              ]}
            />
          }
        />

        <SectionCard className="p-4" surface="soft" density="compact">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sand-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Projeto sem obra vinculada
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                O portal opera sobre a obra vinculada. Este projeto ainda não foi convertido ou perdeu o vínculo com uma obra.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/portal-admin"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao overview
              </Link>
              <Link
                href="/projetos"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Abrir projetos
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="p-4">
          <div className="flex items-start gap-3">
            <FolderKanban className="mt-0.5 h-4 w-4 text-slate-700" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Próximo passo operacional</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Converta este projeto em obra para liberar branding, convites, sessões e acompanhamento do portal do cliente.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionCard className="p-4" surface="soft" density="compact">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sand-700">
              <FolderKanban className="h-3.5 w-3.5" />
              Contexto do projeto
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Projeto <strong>{projeto.nome}</strong> vinculado à obra <strong>{linkedObra.nome}</strong>. O portal abaixo usa os dados operacionais da obra convertida.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/portal-admin"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao overview
            </Link>
            <Link
              href={`/obras/${linkedObra.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Abrir obra
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </SectionCard>

      <PortalAdminObraContent
        obra={{
          id: linkedObra.id,
          nome: linkedObra.nome,
          cliente: linkedObra.cliente,
          status: linkedObra.status,
        }}
        overview={overview}
        activity={activity}
      />
    </div>
  )
}
