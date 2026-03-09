'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  RefreshCcw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { ObraPortalAdminTab } from '@/components/obras/obra-portal-admin-tab'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api/client'
import { PageHeader, QuickActionBar, SectionCard } from '@/components/ui/enterprise'
import type {
  PortalAdminClientActivityPayload,
  PortalAdminObraActivityPayload,
  PortalAdminObraOverviewPayload,
  PortalAdminSessionSummary,
} from '@/shared/types/portal-admin'

interface Props {
  obra: {
    id: string
    nome: string
    cliente: string | null
    status: string | null
  }
  overview: PortalAdminObraOverviewPayload
  activity: PortalAdminObraActivityPayload
}

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

function approvalTone(status: string) {
  if (status === 'aprovado') return 'bg-emerald-100 text-emerald-700'
  if (status === 'rejeitado') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

function isOverdue(value: string | null | undefined) {
  if (!value) return false
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) && ts < Date.now()
}

function commentTone(origin: string) {
  if (origin === 'cliente') return 'bg-blue-100 text-blue-700'
  if (origin === 'interno') return 'bg-slate-100 text-slate-700'
  return 'bg-gray-100 text-gray-700'
}

function followUpTone(state: 'awaiting_internal' | 'awaiting_client' | 'idle') {
  if (state === 'awaiting_internal') return 'bg-amber-100 text-amber-700'
  if (state === 'awaiting_client') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-700'
}

function followUpLabel(state: 'awaiting_internal' | 'awaiting_client' | 'idle') {
  if (state === 'awaiting_internal') return 'Aguardando equipe'
  if (state === 'awaiting_client') return 'Aguardando cliente'
  return 'Sem pendência'
}

function sessionTone(status: PortalAdminSessionSummary['status']) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-700'
  if (status === 'expired') return 'bg-amber-100 text-amber-700'
  if (status === 'revoked') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function sessionLabel(status: PortalAdminSessionSummary['status']) {
  if (status === 'active') return 'Ativa'
  if (status === 'expired') return 'Expirada'
  if (status === 'revoked') return 'Revogada'
  return 'Sem sessão'
}

export function PortalAdminObraContent({ obra, overview, activity }: Props) {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [busyActivityClientId, setBusyActivityClientId] = useState<string | null>(null)
  const [clientActivityError, setClientActivityError] = useState<string | null>(null)
  const [clientActivityById, setClientActivityById] = useState<Record<string, PortalAdminClientActivityPayload>>({})
  const refreshTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  function refreshPage() {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current)
    }

    setIsRefreshing(true)
    toast('Atualizando painel do portal', 'success')
    router.refresh()
    refreshTimeoutRef.current = window.setTimeout(() => {
      setIsRefreshing(false)
      refreshTimeoutRef.current = null
    }, 900)
  }

  async function loadClientActivity(clientId: string) {
    setSelectedClientId(clientId)
    setClientActivityError(null)

    if (clientActivityById[clientId]) {
      return
    }

    setBusyActivityClientId(clientId)
    try {
      const payload = await apiRequest<PortalAdminClientActivityPayload>(
        `/api/v1/portal/admin/obras/${obra.id}/clients/${clientId}/activity`
      )
      setClientActivityById((current) => ({ ...current, [clientId]: payload }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar atividade do cliente'
      setClientActivityError(message)
      toast(message, 'error')
    } finally {
      setBusyActivityClientId(null)
    }
  }

  const selectedClientActivity = selectedClientId ? clientActivityById[selectedClientId] || null : null

  return (
    <div className="tailadmin-page space-y-4" aria-busy={isRefreshing}>
      <PageHeader
        title={obra.nome}
        subtitle={`${obra.cliente || 'Sem cliente'} · ${obra.status || 'Sem status'}`}
        statusLabel="Portal Admin V2"
        actions={
          <QuickActionBar
            actions={[
              {
                label: 'Tentar novamente',
                icon: isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />,
                onClick: refreshPage,
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
              Operação dedicada por obra
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Se houver falha ao carregar branding, clientes, sessões ou convites, use <strong>Tentar novamente</strong> para recarregar este painel dedicado sem sair da obra.
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
              href={`/obras/${obra.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Abrir obra
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="border border-amber-200 bg-amber-50 p-4" density="compact">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900">Guardrail operacional</p>
            <p className="text-sm text-amber-800">
              Qualquer erro ao carregar ou salvar deve ser tratado aqui antes de promover o módulo. Este wrapper mantém refresh explícito, feedback visual e retry controlado.
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SectionCard className="p-4" density="compact">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Pendentes
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{overview.summary.pendingApprovals}</p>
          <p className="mt-1 text-xs text-gray-500">Aprovações aguardando cliente</p>
        </SectionCard>
        <SectionCard className="p-4" density="compact">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aprovadas
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{overview.summary.approvedApprovals}</p>
          <p className="mt-1 text-xs text-gray-500">Histórico de liberações</p>
        </SectionCard>
        <SectionCard className="p-4" density="compact">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            Rejeitadas
          </div>
          <p className="mt-2 text-2xl font-semibold text-red-600">{overview.summary.rejectedApprovals}</p>
          <p className="mt-1 text-xs text-gray-500">Demandam revisão e reenvio</p>
        </SectionCard>
        <SectionCard className="p-4" density="compact">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Clock3 className="h-3.5 w-3.5" />
            SLA vencido
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{overview.summary.overduePendingApprovals}</p>
          <p className="mt-1 text-xs text-gray-500">
            Próximo SLA: {fmtDateTime(overview.summary.nextPendingSlaAt)}
          </p>
        </SectionCard>
        <SectionCard className="p-4" density="compact">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <MessageSquare className="h-3.5 w-3.5" />
            Comentários
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{overview.summary.totalComments}</p>
          <p className="mt-1 text-xs text-gray-500">
            Cliente {overview.summary.clientComments} · Interno {overview.summary.internalComments}
          </p>
        </SectionCard>
        <SectionCard className="p-4" density="compact">
          <div className="text-xs uppercase tracking-wide text-gray-500">Última atividade</div>
          <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{fmtDateTime(overview.summary.latestCommentAt || overview.summary.latestApprovalAt)}</p>
          <p className="mt-1 text-xs text-gray-500">
            Aprovação: {fmtDateTime(overview.summary.latestApprovalAt)}
          </p>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Aprovações recentes"
          subtitle="Últimas decisões e pendências do cliente para esta obra"
          density="compact"
        >
          {overview.summary.overduePendingApprovals > 0 || overview.summary.nextPendingSlaAt ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              {overview.summary.overduePendingApprovals > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {overview.summary.overduePendingApprovals} vencida(s)
                </span>
              ) : null}
              <span>
                Próximo SLA: <strong>{fmtDateTime(overview.summary.nextPendingSlaAt)}</strong>
              </span>
            </div>
          ) : null}
          {overview.recentApprovals.length === 0 ? (
            <p className="text-sm text-gray-500">Sem aprovações registradas para esta obra.</p>
          ) : (
            <div className="space-y-3">
              {overview.recentApprovals.map((approval) => (
                <div key={approval.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{approval.tipo}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${approvalTone(approval.status)}`}>
                        {approval.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{fmtDateTime(approval.solicitado_em)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>SLA: {fmtDateTime(approval.sla_due_at)}</span>
                    <span>Comentário: {approval.decisao_comentario || 'Sem comentário'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Comentários recentes"
          subtitle="Últimas mensagens trocadas no portal desta obra"
          density="compact"
        >
          {overview.recentComments.length === 0 ? (
            <p className="text-sm text-gray-500">Sem comentários no portal até agora.</p>
          ) : (
            <div className="space-y-3">
              {overview.recentComments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${commentTone(comment.origem)}`}>
                      {comment.origem}
                    </span>
                    <span className="text-xs text-gray-500">{fmtDateTime(comment.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{comment.mensagem}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SectionCard className="p-4" density="compact">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <UserRound className="h-3.5 w-3.5" />
            Clientes
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{activity.summary.totalClients}</p>
          <p className="mt-1 text-xs text-gray-500">Ativos {activity.summary.activeClients}</p>
        </SectionCard>
        <SectionCard className="p-4" density="compact">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sessões
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">{activity.summary.activeSessions}</p>
          <p className="mt-1 text-xs text-gray-500">
            Expiradas {activity.summary.expiredSessions} · Revogadas {activity.summary.revokedSessions}
          </p>
        </SectionCard>
        <SectionCard className="p-4" density="compact">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            Nunca ativaram
          </div>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{activity.summary.neverActivated}</p>
          <p className="mt-1 text-xs text-gray-500">Clientes sem sessão válida até agora</p>
        </SectionCard>
        <SectionCard className="p-4" density="compact">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Clock3 className="h-3.5 w-3.5" />
            Último convite
          </div>
          <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{fmtDateTime(activity.summary.latestInviteAt)}</p>
          <p className="mt-1 text-xs text-gray-500">Sessões totais {activity.summary.totalSessions}</p>
        </SectionCard>
        <SectionCard className="p-4" density="compact">
          <div className="text-xs uppercase tracking-wide text-gray-500">Último acesso</div>
          <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{fmtDateTime(activity.summary.latestAccessAt)}</p>
          <p className="mt-1 text-xs text-gray-500">Clientes acessando: {activity.summary.recentlyAccessedClients}</p>
        </SectionCard>
        <SectionCard className="p-4" density="compact">
          <div className="text-xs uppercase tracking-wide text-gray-500">Follow-up</div>
          <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            Equipe {activity.summary.clientsAwaitingInternalReply}
          </p>
          <p className="mt-1 text-xs text-gray-500">Cliente {activity.summary.clientsAwaitingClientReply}</p>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Clientes do portal"
          subtitle="Quem já recebeu convite, quem nunca ativou e qual foi a última sessão por cliente"
          density="compact"
        >
          {activity.clients.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum cliente de portal cadastrado para esta obra.</p>
          ) : (
            <div className="space-y-3">
              {activity.clients.map((client) => (
                <div key={client.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{client.nome}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${client.latest_session ? sessionTone(client.latest_session.status) : sessionTone('none')}`}>
                          {client.latest_session ? sessionLabel(client.latest_session.status) : 'Sem sessão'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${followUpTone(client.follow_up_state)}`}>
                          {followUpLabel(client.follow_up_state)}
                        </span>
                        {!client.ativo ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                            Inativo
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{client.email}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span>Telefone: {client.telefone || '—'}</span>
                        <span>Convite: {fmtDateTime(client.last_invite_at)}</span>
                        <span>Acesso: {fmtDateTime(client.last_accessed_at)}</span>
                        <span>Último comentário: {fmtDateTime(client.latest_comment_at)}</span>
                      </div>
                      {client.latest_comment_preview ? (
                        <p className="text-xs text-gray-500">
                          Última mensagem: {client.latest_comment_preview}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2 text-right text-xs text-gray-500">
                      <div>
                        <div>Sessões: {client.total_sessions}</div>
                        <div>{client.never_activated ? 'Nunca ativou' : 'Já ativado'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadClientActivity(client.id)}
                        disabled={busyActivityClientId === client.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {busyActivityClientId === client.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        {selectedClientId === client.id ? 'Recarregar atividade' : 'Ver atividade'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Sessões recentes"
          subtitle="Últimos convites e acessos do portal desta obra"
          density="compact"
        >
          {activity.recentSessions.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma sessão registrada para esta obra.</p>
          ) : (
            <div className="space-y-3">
              {activity.recentSessions.map((session) => (
                <div key={session.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{session.portal_cliente_nome}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sessionTone(session.status)}`}>
                          {sessionLabel(session.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{session.portal_cliente_email}</p>
                    </div>
                    <span className="text-xs text-gray-500">{fmtDateTime(session.created_at)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>Expira: {fmtDateTime(session.expires_at)}</span>
                    <span>Último acesso: {fmtDateTime(session.last_accessed_at)}</span>
                    <span>Revogada: {fmtDateTime(session.revoked_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Drilldown por cliente"
        subtitle="Sessões, comentários e decisões do cliente selecionado"
        density="compact"
      >
        {!selectedClientId ? (
          <p className="text-sm text-gray-500">Selecione um cliente acima para carregar a atividade detalhada.</p>
        ) : clientActivityError && !selectedClientActivity ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{clientActivityError}</p>
            <button
              type="button"
              onClick={() => void loadClientActivity(selectedClientId)}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
            >
              Tentar novamente
            </button>
          </div>
        ) : !selectedClientActivity ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
            Carregando atividade do cliente...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
              <SectionCard className="p-4" density="compact">
                <div className="text-xs uppercase tracking-wide text-gray-500">Sessões</div>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                  {selectedClientActivity.summary.totalSessions}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Ativas {selectedClientActivity.summary.activeSessions}
                </p>
              </SectionCard>
              <SectionCard className="p-4" density="compact">
                <div className="text-xs uppercase tracking-wide text-gray-500">Comentários</div>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                  {selectedClientActivity.summary.totalComments}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Cliente {selectedClientActivity.summary.clientComments} · Interno {selectedClientActivity.summary.internalComments}
                </p>
              </SectionCard>
              <SectionCard className="p-4" density="compact">
                <div className="text-xs uppercase tracking-wide text-gray-500">Decisões</div>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                  {selectedClientActivity.summary.totalDecisions}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Aprovadas {selectedClientActivity.summary.approvedDecisions} · Rejeitadas {selectedClientActivity.summary.rejectedDecisions}
                </p>
              </SectionCard>
              <SectionCard className="p-4" density="compact">
                <div className="text-xs uppercase tracking-wide text-gray-500">Pendentes atribuídas</div>
                <p className="mt-2 text-2xl font-semibold text-amber-600">
                  {selectedClientActivity.summary.pendingAssignedApprovals}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Vencidas {selectedClientActivity.summary.overduePendingApprovals}
                </p>
              </SectionCard>
              <SectionCard className="p-4" density="compact">
                <div className="text-xs uppercase tracking-wide text-gray-500">Último acesso</div>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  {fmtDateTime(selectedClientActivity.summary.latestAccessAt)}
                </p>
              </SectionCard>
              <SectionCard className="p-4" density="compact">
                <div className="text-xs uppercase tracking-wide text-gray-500">Próximo SLA</div>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  {fmtDateTime(selectedClientActivity.summary.nextPendingSlaAt)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {selectedClientActivity.summary.nextPendingSlaAt && isOverdue(selectedClientActivity.summary.nextPendingSlaAt)
                    ? 'SLA vencido'
                    : 'Próxima pendência atribuída'}
                </p>
              </SectionCard>
              <SectionCard className="p-4" density="compact">
                <div className="text-xs uppercase tracking-wide text-gray-500">Última decisão</div>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  {fmtDateTime(selectedClientActivity.summary.latestDecisionAt)}
                </p>
              </SectionCard>
              <SectionCard className="p-4" density="compact">
                <div className="text-xs uppercase tracking-wide text-gray-500">Follow-up</div>
                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                  {followUpLabel(selectedClientActivity.summary.followUpState)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Origem: {selectedClientActivity.summary.latestCommentOrigin || 'sem comentário'}
                </p>
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
              <SectionCard title="Sessões recentes" density="compact">
                {selectedClientActivity.recentSessions.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma sessão para este cliente.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedClientActivity.recentSessions.map((session) => (
                      <div key={session.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sessionTone(session.status)}`}>
                            {sessionLabel(session.status)}
                          </span>
                          <span className="text-xs text-gray-500">{fmtDateTime(session.created_at)}</span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500">
                          <span>Expira: {fmtDateTime(session.expires_at)}</span>
                          <span>Último acesso: {fmtDateTime(session.last_accessed_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Pendências atribuídas" density="compact">
                {selectedClientActivity.recentPendingApprovals.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem aprovações pendentes atribuídas a este cliente.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedClientActivity.recentPendingApprovals.map((approval) => (
                      <div key={approval.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{approval.tipo}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${approvalTone(approval.status)}`}>
                              {approval.status}
                            </span>
                            {isOverdue(approval.sla_due_at) ? (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                SLA vencido
                              </span>
                            ) : null}
                          </div>
                          <span className="text-xs text-gray-500">{fmtDateTime(approval.solicitado_em)}</span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500">
                          <span>SLA: {fmtDateTime(approval.sla_due_at)}</span>
                          <span>Comentário: {approval.decisao_comentario || 'Sem comentário'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Comentários recentes" density="compact">
                {selectedClientActivity.recentComments.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem comentários deste cliente.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedClientActivity.recentComments.map((comment) => (
                      <div key={comment.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${commentTone(comment.origem)}`}>
                            {comment.origem}
                          </span>
                          <span className="text-xs text-gray-500">{fmtDateTime(comment.created_at)}</span>
                        </div>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{comment.mensagem}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Decisões recentes" density="compact">
                {selectedClientActivity.recentDecisions.length === 0 ? (
                  <p className="text-sm text-gray-500">Este cliente ainda não decidiu aprovações.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedClientActivity.recentDecisions.map((decision) => (
                      <div key={decision.id} className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{decision.tipo}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${approvalTone(decision.status)}`}>
                              {decision.status}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {fmtDateTime(decision.decidido_em || decision.solicitado_em)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          Comentário: {decision.decisao_comentario || 'Sem comentário'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </SectionCard>

      <ObraPortalAdminTab obraId={obra.id} v2Enabled />
    </div>
  )
}
