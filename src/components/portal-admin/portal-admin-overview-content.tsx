'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Mail, MessageSquare, RefreshCcw, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequestWithMeta } from '@/lib/api/client'
import type { PortalAdminOverviewItem, PortalAdminOverviewSummary } from '@/shared/types/portal-admin'
import { EmptyStateAction, PageHeader, PaginationControls, QuickActionBar, SectionCard } from '@/components/ui/enterprise'

interface Props {
  initialItems: PortalAdminOverviewItem[]
  initialSummary: PortalAdminOverviewSummary
  initialTotal: number
}

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  summary?: PortalAdminOverviewSummary
}

const PAGE_SIZE = 24

function fmtDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function obraStatusTone(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('concl')) return 'bg-emerald-100 text-emerald-700'
  if (normalized.includes('atra') || normalized.includes('bloq')) return 'bg-red-100 text-red-700'
  if (normalized.includes('andamento')) return 'bg-blue-100 text-blue-700'
  return 'bg-amber-100 text-amber-700'
}

export function PortalAdminOverviewContent({ initialItems, initialSummary, initialTotal }: Props) {
  const [items, setItems] = useState(initialItems)
  const [summary, setSummary] = useState(initialSummary)
  const [pagination, setPagination] = useState<PaginationMeta>({
    count: initialItems.length,
    page: 1,
    pageSize: PAGE_SIZE,
    total: initialTotal,
    hasMore: initialTotal > initialItems.length,
    summary: initialSummary,
  })
  const [search, setSearch] = useState('')
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const priorityRows = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.total_clients === 0 ||
            item.never_activated > 0 ||
            item.expired_sessions > 0 ||
            item.overdue_pending_approvals > 0 ||
            item.clients_awaiting_internal_reply > 0
        )
        .slice(0, 3),
    [items]
  )

  async function refresh(targetPage = 1) {
    setIsPageLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      })
      if (search.trim()) params.set('q', search.trim())
      const payload = await apiRequestWithMeta<PortalAdminOverviewItem[], PaginationMeta>(`/api/v1/portal/admin/overview?${params.toString()}`)
      setItems(payload.data)
      setPagination(
        payload.meta || {
          count: payload.data.length,
          page: targetPage,
          pageSize: PAGE_SIZE,
          total: payload.data.length,
          hasMore: false,
        }
      )
      setSummary(payload.meta?.summary || initialSummary)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar overview do portal'
      setLoadError(message)
      toast(message, 'error')
    } finally {
      setIsPageLoading(false)
    }
  }

  useEffect(() => {
    void refresh(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isPageLoading && items.length === 0) {
    return (
      <div className="tailadmin-page space-y-4">
        <PageHeader
          title="Portal Admin"
          subtitle="Governança central do portal do cliente"
          actions={
            <QuickActionBar
              actions={[
                {
                  label: 'Atualizar',
                  icon: <RefreshCcw className="h-4 w-4" />,
                  onClick: () => void refresh(1),
                },
              ]}
            />
          }
        />
        <EmptyStateAction
          icon={<Sparkles className="h-5 w-5 text-sand-600" />}
          title="Nenhuma obra disponível no portal"
          description="Assim que houver obras e clientes no portal, você verá aqui branding, sessões, convites e prioridades de ativação."
          actionLabel="Abrir Obras"
          actionHref="/obras"
        />
      </div>
    )
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isPageLoading}>
      <PageHeader
        title="Portal Admin"
        subtitle={`${pagination.total || items.length} obras monitoradas no portal`}
        actions={
          <QuickActionBar
            actions={[
              {
                label: 'Atualizar',
                icon: <RefreshCcw className="h-4 w-4" />,
                onClick: () => void refresh(pagination.page || 1),
              },
            ]}
          />
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Sparkles className="h-3.5 w-3.5" />Obras
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.totalObras}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5" />Branding configurado
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{summary.configuredObras}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Users className="h-3.5 w-3.5" />Clientes ativos
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{summary.activeClients}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Mail className="h-3.5 w-3.5" />Email habilitado
          </div>
          <p className="mt-2 text-2xl font-semibold text-blue-600">{summary.emailEnabledObras}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <RefreshCcw className="h-3.5 w-3.5" />Sessões ativas
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{summary.activeSessions}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <MessageSquare className="h-3.5 w-3.5" />Aguardando equipe
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{summary.clientsAwaitingInternalReply}</p>
        </SectionCard>
        <SectionCard className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <AlertTriangle className="h-3.5 w-3.5" />SLA vencido
          </div>
          <p className="mt-2 text-2xl font-semibold text-red-600">{summary.overduePendingApprovals}</p>
        </SectionCard>
      </div>

      {priorityRows.length > 0 ? (
        <SectionCard
          title="O que precisa de ação agora"
          subtitle="Obras com reply pendente para a equipe, approvals vencidas, sessões expiradas ou sem ativação"
          surface="soft"
          density="compact"
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {priorityRows.map((item) => (
              <Link
                key={item.obra_id}
                href={`/portal-admin/${item.obra_id}`}
                className="rounded-2xl border border-sand-200 bg-white/90 p-4 transition hover:-translate-y-0.5 hover:border-sand-300 hover:shadow-sm dark:border-sand-900/40 dark:bg-gray-950/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{item.obra_nome}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${obraStatusTone(item.obra_status)}`}>{item.obra_status}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.cliente}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900">Sem portal: <strong>{item.total_clients === 0 ? 'sim' : 'não'}</strong></div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900">Nunca ativou: <strong>{item.never_activated}</strong></div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900">Expiradas: <strong>{item.expired_sessions}</strong></div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900">Ativas: <strong>{item.active_sessions}</strong></div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900">Aguardando equipe: <strong>{item.clients_awaiting_internal_reply}</strong></div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900">SLA vencido: <strong>{item.overdue_pending_approvals}</strong></div>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard className="p-4">
        <div className="flex flex-col gap-2 lg:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por obra ou cliente..."
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="button"
            onClick={() => void refresh(1)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Aplicar
          </button>
        </div>
      </SectionCard>

      {loadError ? (
        <SectionCard className="border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={() => void refresh(pagination.page || 1)}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
            >
              Tentar novamente
            </button>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <SectionCard key={item.obra_id} className="p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{item.obra_nome}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${obraStatusTone(item.obra_status)}`}>{item.obra_status}</span>
                  {item.notificar_por_email ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Email ativo</span>
                  ) : null}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.cliente}</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Branding: {item.branding_nome || 'Padrão da obra'}</span>
                  <span>Última atividade: {fmtDateTime(item.latest_portal_activity_at)}</span>
                  <span>Última sessão: {fmtDateTime(item.last_session_created_at)}</span>
                  <span>Expira em: {fmtDateTime(item.last_session_expires_at)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/portal-admin/${item.obra_id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Abrir painel
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`/obras/${item.obra_id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Abrir obra
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-9">
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Clientes</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{item.total_clients}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Ativos</p>
                <p className="mt-1 text-lg font-semibold text-emerald-600">{item.active_clients}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Sessões ativas</p>
                <p className="mt-1 text-lg font-semibold text-blue-600">{item.active_sessions}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Expiradas</p>
                <p className="mt-1 text-lg font-semibold text-amber-600">{item.expired_sessions}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Revogadas</p>
                <p className="mt-1 text-lg font-semibold text-red-600">{item.revoked_sessions}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Sem ativar</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{item.never_activated}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Pendentes</p>
                <p className="mt-1 text-lg font-semibold text-amber-600">{item.pending_approvals}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">SLA vencido</p>
                <p className="mt-1 text-lg font-semibold text-red-600">{item.overdue_pending_approvals}</p>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Aguardando equipe</p>
                <p className="mt-1 text-lg font-semibold text-amber-600">{item.clients_awaiting_internal_reply}</p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>

      <PaginationControls
        page={pagination.page || 1}
        pageSize={pagination.pageSize || PAGE_SIZE}
        total={pagination.total || items.length}
        hasMore={pagination.hasMore}
        isLoading={isPageLoading}
        onPrev={() => void refresh(Math.max(1, (pagination.page || 1) - 1))}
        onNext={() => void refresh((pagination.page || 1) + 1)}
      />
    </div>
  )
}
