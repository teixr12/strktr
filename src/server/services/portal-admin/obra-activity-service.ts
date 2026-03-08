import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PortalCommentFollowUpState,
  PortalAdminObraActivityPayload,
  PortalAdminObraClientActivityItem,
  PortalAdminObraSessionActivityItem,
  PortalAdminSessionSummary,
  PortalSessionStatus,
} from '@/shared/types/portal-admin'

type PortalClientRow = {
  id: string
  nome: string
  email: string
  telefone: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

type PortalSessionRow = {
  id: string
  portal_cliente_id: string
  expires_at: string
  revoked_at: string | null
  created_at: string
  last_accessed_at: string | null
}

type PortalCommentRow = {
  id: string
  portal_cliente_id: string
  origem: string
  mensagem: string
  created_at: string
}

function resolveSessionStatus(
  session: Pick<PortalSessionRow, 'expires_at' | 'revoked_at'> | null
): PortalSessionStatus {
  if (!session) return 'none'
  if (session.revoked_at) return 'revoked'
  const expiresAtTs = new Date(session.expires_at).getTime()
  if (Number.isFinite(expiresAtTs) && expiresAtTs < Date.now()) return 'expired'
  return 'active'
}

function toSessionSummary(session: PortalSessionRow): PortalAdminSessionSummary {
  return {
    id: session.id,
    status: resolveSessionStatus(session),
    expires_at: session.expires_at,
    revoked_at: session.revoked_at,
    created_at: session.created_at,
    last_accessed_at: session.last_accessed_at,
  }
}

function resolveFollowUpState(origin: string | null): PortalCommentFollowUpState {
  if (origin === 'cliente') return 'awaiting_internal'
  if (origin === 'interno') return 'awaiting_client'
  return 'idle'
}

export async function getPortalAdminObraActivity({
  supabase,
  orgId,
  obraId,
}: {
  supabase: SupabaseClient
  orgId: string
  obraId: string
}): Promise<PortalAdminObraActivityPayload> {
  const { data: clientsData, error: clientsError } = await supabase
    .from('portal_clientes')
    .select('id, nome, email, telefone, ativo, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('obra_id', obraId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (clientsError) {
    throw new Error(clientsError.message)
  }

  const clients = ((clientsData || []) as unknown) as PortalClientRow[]
  const clientIds = clients.map((client) => client.id)

  if (clientIds.length === 0) {
    return {
      summary: {
        totalClients: 0,
        activeClients: 0,
        activeSessions: 0,
        expiredSessions: 0,
        revokedSessions: 0,
        neverActivated: 0,
        totalSessions: 0,
        recentlyAccessedClients: 0,
        clientsAwaitingInternalReply: 0,
        clientsAwaitingClientReply: 0,
        latestInviteAt: null,
        latestAccessAt: null,
      },
      clients: [],
      recentSessions: [],
    }
  }

  const { data: sessionsData, error: sessionsError } = await supabase
    .from('portal_sessions')
    .select('id, portal_cliente_id, expires_at, revoked_at, created_at, last_accessed_at')
    .eq('org_id', orgId)
    .eq('obra_id', obraId)
    .in('portal_cliente_id', clientIds)
    .order('created_at', { ascending: false })
    .limit(120)

  if (sessionsError) {
    throw new Error(sessionsError.message)
  }

  const { data: commentsData, error: commentsError } = await supabase
    .from('portal_comentarios')
    .select('id, portal_cliente_id, origem, mensagem, created_at')
    .eq('org_id', orgId)
    .eq('obra_id', obraId)
    .in('portal_cliente_id', clientIds)
    .order('created_at', { ascending: false })
    .limit(240)

  if (commentsError) {
    throw new Error(commentsError.message)
  }

  const sessions = ((sessionsData || []) as unknown) as PortalSessionRow[]
  const comments = ((commentsData || []) as unknown) as PortalCommentRow[]
  const clientById = new Map(clients.map((client) => [client.id, client]))
  const latestSessionByClient = new Map<string, PortalAdminSessionSummary>()
  const sessionCountByClient = new Map<string, number>()
  const latestCommentByClient = new Map<string, PortalCommentRow>()

  for (const session of sessions) {
    sessionCountByClient.set(
      session.portal_cliente_id,
      (sessionCountByClient.get(session.portal_cliente_id) || 0) + 1
    )
    if (!latestSessionByClient.has(session.portal_cliente_id)) {
      latestSessionByClient.set(session.portal_cliente_id, toSessionSummary(session))
    }
  }

  for (const comment of comments) {
    if (!latestCommentByClient.has(comment.portal_cliente_id)) {
      latestCommentByClient.set(comment.portal_cliente_id, comment)
    }
  }

  const clientItems = clients.map<PortalAdminObraClientActivityItem>((client) => {
    const latestSession = latestSessionByClient.get(client.id) || null
    const latestComment = latestCommentByClient.get(client.id) || null
    return {
      id: client.id,
      nome: client.nome,
      email: client.email,
      telefone: client.telefone,
      ativo: client.ativo,
      created_at: client.created_at,
      updated_at: client.updated_at,
      total_sessions: sessionCountByClient.get(client.id) || 0,
      never_activated: !latestSession,
      last_invite_at: latestSession?.created_at || null,
      last_accessed_at: latestSession?.last_accessed_at || null,
      latest_comment_at: latestComment?.created_at || null,
      latest_comment_origin: latestComment?.origem || null,
      latest_comment_preview: latestComment?.mensagem || null,
      follow_up_state: resolveFollowUpState(latestComment?.origem || null),
      latest_session: latestSession,
    }
  })

  const recentSessions = sessions.slice(0, 12).map<PortalAdminObraSessionActivityItem>((session) => {
    const client = clientById.get(session.portal_cliente_id)
    return {
      id: session.id,
      portal_cliente_id: session.portal_cliente_id,
      portal_cliente_nome: client?.nome || 'Cliente removido',
      portal_cliente_email: client?.email || 'Sem e-mail',
      status: resolveSessionStatus(session),
      created_at: session.created_at,
      expires_at: session.expires_at,
      revoked_at: session.revoked_at,
      last_accessed_at: session.last_accessed_at,
    }
  })

  const summary = clientItems.reduce<PortalAdminObraActivityPayload['summary']>(
    (acc, client) => {
      acc.totalClients += 1
      if (client.ativo) acc.activeClients += 1
      if (client.never_activated) acc.neverActivated += 1
      if (client.last_accessed_at) acc.recentlyAccessedClients += 1
      if (client.follow_up_state === 'awaiting_internal') acc.clientsAwaitingInternalReply += 1
      if (client.follow_up_state === 'awaiting_client') acc.clientsAwaitingClientReply += 1
      acc.totalSessions += client.total_sessions
      if (!acc.latestInviteAt || (client.last_invite_at && client.last_invite_at > acc.latestInviteAt)) {
        acc.latestInviteAt = client.last_invite_at
      }
      if (!acc.latestAccessAt || (client.last_accessed_at && client.last_accessed_at > acc.latestAccessAt)) {
        acc.latestAccessAt = client.last_accessed_at
      }
      const status = client.latest_session?.status || 'none'
      if (status === 'active') acc.activeSessions += 1
      if (status === 'expired') acc.expiredSessions += 1
      if (status === 'revoked') acc.revokedSessions += 1
      return acc
    },
    {
      totalClients: 0,
      activeClients: 0,
      activeSessions: 0,
      expiredSessions: 0,
      revokedSessions: 0,
      neverActivated: 0,
      totalSessions: 0,
      recentlyAccessedClients: 0,
      clientsAwaitingInternalReply: 0,
      clientsAwaitingClientReply: 0,
      latestInviteAt: null,
      latestAccessAt: null,
    }
  )

  return {
    summary,
    clients: clientItems,
    recentSessions,
  }
}
