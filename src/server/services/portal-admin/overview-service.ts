import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PortalCommentFollowUpState,
  PortalAdminOverviewItem,
  PortalAdminOverviewSummary,
  PortalSessionStatus,
} from '@/shared/types/portal-admin'

type ObraRow = {
  id: string
  nome: string
  cliente: string | null
  status: string | null
  updated_at: string
}

type SettingsRow = {
  obra_id: string
  branding_nome: string | null
  branding_cor_primaria: string | null
  notificar_por_email: boolean | null
}

type PortalClientRow = {
  id: string
  obra_id: string
  ativo: boolean
}

type PortalSessionRow = {
  id: string
  obra_id: string
  portal_cliente_id: string
  expires_at: string
  revoked_at: string | null
  created_at: string
  last_accessed_at: string | null
}

type PortalCommentRow = {
  obra_id: string
  portal_cliente_id: string
  origem: string
  created_at: string
}

type ApprovalRow = {
  obra_id: string
  status: string
  solicitado_em: string | null
  sla_due_at: string | null
}

export type PortalAdminOverviewResult = {
  items: PortalAdminOverviewItem[]
  summary: PortalAdminOverviewSummary
  total: number
}

function normalizeSearchTerm(value: string | null | undefined): string | null {
  const normalized = (value || '').trim().replace(/[%_,]/g, '')
  return normalized.length > 0 ? normalized : null
}

function resolveSessionStatus(session: Pick<PortalSessionRow, 'expires_at' | 'revoked_at'> | null): PortalSessionStatus {
  if (!session) return 'none'
  if (session.revoked_at) return 'revoked'
  const expiresAtTs = new Date(session.expires_at).getTime()
  if (Number.isFinite(expiresAtTs) && expiresAtTs < Date.now()) return 'expired'
  return 'active'
}

function resolveFollowUpState(origin: string | null): PortalCommentFollowUpState {
  if (origin === 'cliente') return 'awaiting_internal'
  if (origin === 'interno') return 'awaiting_client'
  return 'idle'
}

function pickLatest(current: string | null, candidate: string | null | undefined) {
  if (!candidate) return current
  if (!current) return candidate
  return candidate > current ? candidate : current
}

export async function listPortalAdminOverview({
  supabase,
  orgId,
  page = 1,
  pageSize = 24,
  search,
}: {
  supabase: SupabaseClient
  orgId: string
  page?: number
  pageSize?: number
  search?: string | null
}): Promise<PortalAdminOverviewResult> {
  const normalizedSearch = normalizeSearchTerm(search)
  const safePage = Math.max(1, page)
  const safePageSize = Math.max(1, Math.min(pageSize, 50))
  const offset = (safePage - 1) * safePageSize

  let obrasQuery = supabase
    .from('obras')
    .select('id, nome, cliente, status, updated_at', { count: 'exact' })
    .eq('org_id', orgId)

  if (normalizedSearch) {
    obrasQuery = obrasQuery.or(`nome.ilike.%${normalizedSearch}%,cliente.ilike.%${normalizedSearch}%`)
  }

  const { data: obrasData, count, error: obrasError } = await obrasQuery
    .order('updated_at', { ascending: false })
    .range(offset, offset + safePageSize - 1)

  if (obrasError) {
    throw new Error(obrasError.message)
  }

  const obras = ((obrasData || []) as unknown) as ObraRow[]
  const obraIds = obras.map((obra) => obra.id)

  if (obraIds.length === 0) {
    return {
      items: [],
      total: count ?? 0,
      summary: {
        totalObras: count ?? 0,
        configuredObras: 0,
        obrasWithoutPortal: 0,
        totalClients: 0,
        activeClients: 0,
        activeSessions: 0,
        emailEnabledObras: 0,
        pendingApprovals: 0,
        overduePendingApprovals: 0,
        clientsAwaitingInternalReply: 0,
        clientsAwaitingClientReply: 0,
      },
    }
  }

  const [settingsRes, clientsRes] = await Promise.all([
    supabase
      .from('portal_admin_settings')
      .select('obra_id, branding_nome, branding_cor_primaria, notificar_por_email')
      .eq('org_id', orgId)
      .in('obra_id', obraIds),
    supabase
      .from('portal_clientes')
      .select('id, obra_id, ativo')
      .eq('org_id', orgId)
      .in('obra_id', obraIds),
  ])

  if (settingsRes.error) {
    throw new Error(settingsRes.error.message)
  }
  if (clientsRes.error) {
    throw new Error(clientsRes.error.message)
  }

  const settingsRows = ((settingsRes.data || []) as unknown) as SettingsRow[]
  const clientRows = ((clientsRes.data || []) as unknown) as PortalClientRow[]
  const clientIds = clientRows.map((client) => client.id)

  const [sessionsRes, commentsRes, approvalsRes] = await Promise.all([
    clientIds.length > 0
      ? supabase
          .from('portal_sessions')
          .select('id, obra_id, portal_cliente_id, expires_at, revoked_at, created_at, last_accessed_at')
          .eq('org_id', orgId)
          .in('portal_cliente_id', clientIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    clientIds.length > 0
      ? supabase
          .from('portal_comentarios')
          .select('obra_id, portal_cliente_id, origem, created_at')
          .eq('org_id', orgId)
          .in('portal_cliente_id', clientIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('aprovacoes_cliente')
      .select('obra_id, status, solicitado_em, sla_due_at')
      .eq('org_id', orgId)
      .in('obra_id', obraIds)
      .order('solicitado_em', { ascending: false }),
  ])

  if (sessionsRes.error) {
    throw new Error(sessionsRes.error.message)
  }
  if (commentsRes.error) {
    throw new Error(commentsRes.error.message)
  }
  if (approvalsRes.error) {
    throw new Error(approvalsRes.error.message)
  }

  const sessionRows = ((sessionsRes.data || []) as unknown) as PortalSessionRow[]
  const commentRows = ((commentsRes.data || []) as unknown) as PortalCommentRow[]
  const approvalRows = ((approvalsRes.data || []) as unknown) as ApprovalRow[]

  const settingsByObra = new Map(settingsRows.map((row) => [row.obra_id, row]))
  const clientsByObra = new Map<string, PortalClientRow[]>()
  for (const client of clientRows) {
    const bucket = clientsByObra.get(client.obra_id) || []
    bucket.push(client)
    clientsByObra.set(client.obra_id, bucket)
  }

  const latestSessionByClient = new Map<string, PortalSessionRow>()
  const latestCommentByClient = new Map<string, PortalCommentRow>()
  for (const session of sessionRows) {
    if (!latestSessionByClient.has(session.portal_cliente_id)) {
      latestSessionByClient.set(session.portal_cliente_id, session)
    }
  }

  for (const comment of commentRows) {
    if (!latestCommentByClient.has(comment.portal_cliente_id)) {
      latestCommentByClient.set(comment.portal_cliente_id, comment)
    }
  }

  const awaitingInternalByObra = new Map<string, number>()
  const awaitingClientByObra = new Map<string, number>()
  for (const client of clientRows) {
    const latestComment = latestCommentByClient.get(client.id) || null
    const followUpState = resolveFollowUpState(latestComment?.origem || null)
    if (followUpState === 'awaiting_internal') {
      awaitingInternalByObra.set(client.obra_id, (awaitingInternalByObra.get(client.obra_id) || 0) + 1)
    }
    if (followUpState === 'awaiting_client') {
      awaitingClientByObra.set(client.obra_id, (awaitingClientByObra.get(client.obra_id) || 0) + 1)
    }
  }

  const pendingApprovalsByObra = new Map<string, number>()
  const overduePendingApprovalsByObra = new Map<string, number>()
  const latestApprovalAtByObra = new Map<string, string | null>()
  const nowIso = new Date().toISOString()

  for (const approval of approvalRows) {
    latestApprovalAtByObra.set(
      approval.obra_id,
      pickLatest(latestApprovalAtByObra.get(approval.obra_id) || null, approval.solicitado_em)
    )

    if (approval.status !== 'pendente') continue

    pendingApprovalsByObra.set(approval.obra_id, (pendingApprovalsByObra.get(approval.obra_id) || 0) + 1)
    if (approval.sla_due_at && approval.sla_due_at < nowIso) {
      overduePendingApprovalsByObra.set(
        approval.obra_id,
        (overduePendingApprovalsByObra.get(approval.obra_id) || 0) + 1
      )
    }
  }

  const items = obras.map((obra) => {
    const settings = settingsByObra.get(obra.id) || null
    const obraClients = clientsByObra.get(obra.id) || []
    let activeClients = 0
    let activeSessions = 0
    let expiredSessions = 0
    let revokedSessions = 0
    let neverActivated = 0
    let lastSessionCreatedAt: string | null = null
    let lastSessionExpiresAt: string | null = null
    let latestPortalActivityAt: string | null = latestApprovalAtByObra.get(obra.id) || null

    for (const client of obraClients) {
      if (client.ativo) activeClients += 1
      const latestSession = latestSessionByClient.get(client.id) || null
      const latestComment = latestCommentByClient.get(client.id) || null
      const status = resolveSessionStatus(latestSession)
      if (status === 'active') activeSessions += 1
      if (status === 'expired') expiredSessions += 1
      if (status === 'revoked') revokedSessions += 1
      if (status === 'none') neverActivated += 1
      if (latestSession) {
        if (!lastSessionCreatedAt || latestSession.created_at > lastSessionCreatedAt) {
          lastSessionCreatedAt = latestSession.created_at
          lastSessionExpiresAt = latestSession.expires_at
        }
        latestPortalActivityAt = pickLatest(latestPortalActivityAt, latestSession.created_at)
        latestPortalActivityAt = pickLatest(latestPortalActivityAt, latestSession.last_accessed_at)
      }
      latestPortalActivityAt = pickLatest(latestPortalActivityAt, latestComment?.created_at)
    }

    return {
      obra_id: obra.id,
      obra_nome: obra.nome,
      cliente: obra.cliente || 'Sem cliente',
      obra_status: obra.status || 'Sem status',
      obra_updated_at: obra.updated_at,
      branding_nome: settings?.branding_nome || null,
      branding_cor_primaria: settings?.branding_cor_primaria || null,
      notificar_por_email: Boolean(settings?.notificar_por_email),
      total_clients: obraClients.length,
      active_clients: activeClients,
      active_sessions: activeSessions,
      expired_sessions: expiredSessions,
      revoked_sessions: revokedSessions,
      never_activated: neverActivated,
      pending_approvals: pendingApprovalsByObra.get(obra.id) || 0,
      overdue_pending_approvals: overduePendingApprovalsByObra.get(obra.id) || 0,
      clients_awaiting_internal_reply: awaitingInternalByObra.get(obra.id) || 0,
      clients_awaiting_client_reply: awaitingClientByObra.get(obra.id) || 0,
      latest_portal_activity_at: latestPortalActivityAt,
      last_session_created_at: lastSessionCreatedAt,
      last_session_expires_at: lastSessionExpiresAt,
    } satisfies PortalAdminOverviewItem
  })

  const summary = items.reduce<PortalAdminOverviewSummary>(
    (acc, item) => {
      acc.configuredObras += item.branding_nome || item.branding_cor_primaria ? 1 : 0
      acc.obrasWithoutPortal += item.total_clients === 0 ? 1 : 0
      acc.totalClients += item.total_clients
      acc.activeClients += item.active_clients
      acc.activeSessions += item.active_sessions
      acc.emailEnabledObras += item.notificar_por_email ? 1 : 0
      acc.pendingApprovals += item.pending_approvals
      acc.overduePendingApprovals += item.overdue_pending_approvals
      acc.clientsAwaitingInternalReply += item.clients_awaiting_internal_reply
      acc.clientsAwaitingClientReply += item.clients_awaiting_client_reply
      return acc
    },
    {
      totalObras: count ?? items.length,
      configuredObras: 0,
      obrasWithoutPortal: 0,
      totalClients: 0,
      activeClients: 0,
      activeSessions: 0,
      emailEnabledObras: 0,
      pendingApprovals: 0,
      overduePendingApprovals: 0,
      clientsAwaitingInternalReply: 0,
      clientsAwaitingClientReply: 0,
    }
  )

  return {
    items,
    summary,
    total: count ?? items.length,
  }
}
