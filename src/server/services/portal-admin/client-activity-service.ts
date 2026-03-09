import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PortalCommentFollowUpState,
  PortalAdminClientActivityPayload,
  PortalAdminClientCommentItem,
  PortalAdminClientDecisionItem,
  PortalAdminClientPendingApprovalItem,
  PortalAdminObraClientActivityItem,
  PortalAdminObraSessionActivityItem,
  PortalAdminSessionSummary,
  PortalSessionStatus,
} from '@/shared/types/portal-admin'

type PortalSessionRow = {
  id: string
  portal_cliente_id: string
  expires_at: string
  revoked_at: string | null
  created_at: string
  last_accessed_at: string | null
}

type ApprovalRow = PortalAdminClientDecisionItem
type PendingApprovalRow = PortalAdminClientPendingApprovalItem
type CommentRow = PortalAdminClientCommentItem

function resolveFollowUpState(origin: string | null): PortalCommentFollowUpState {
  if (origin === 'cliente') return 'awaiting_internal'
  if (origin === 'interno') return 'awaiting_client'
  return 'idle'
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

export async function getPortalAdminClientActivity({
  supabase,
  orgId,
  obraId,
  clientId,
}: {
  supabase: SupabaseClient
  orgId: string
  obraId: string
  clientId: string
}): Promise<PortalAdminClientActivityPayload | null> {
  const { data: clientData, error: clientError } = await supabase
    .from('portal_clientes')
    .select('id, nome, email, telefone, ativo, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('obra_id', obraId)
    .eq('id', clientId)
    .maybeSingle()

  if (clientError) {
    throw new Error(clientError.message)
  }
  if (!clientData) {
    return null
  }

  const [
    sessionsRes,
    commentsRes,
    totalCommentsRes,
    clientCommentsRes,
    decisionsRes,
    totalDecisionsRes,
    approvedDecisionsRes,
    rejectedDecisionsRes,
  ] = await Promise.all([
    supabase
      .from('portal_sessions')
      .select('id, portal_cliente_id, expires_at, revoked_at, created_at, last_accessed_at')
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('portal_cliente_id', clientId)
      .order('created_at', { ascending: false })
      .limit(24),
    supabase
      .from('portal_comentarios')
      .select('id, origem, mensagem, created_at')
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('portal_cliente_id', clientId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('portal_comentarios')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('portal_cliente_id', clientId),
    supabase
      .from('portal_comentarios')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('portal_cliente_id', clientId)
      .eq('origem', 'cliente'),
    supabase
      .from('aprovacoes_cliente')
      .select('id, tipo, status, solicitado_em, decidido_em, decisao_comentario')
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('decidido_por_portal_cliente_id', clientId)
      .order('decidido_em', { ascending: false })
      .limit(8),
    supabase
      .from('aprovacoes_cliente')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('decidido_por_portal_cliente_id', clientId),
    supabase
      .from('aprovacoes_cliente')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('decidido_por_portal_cliente_id', clientId)
      .eq('status', 'aprovado'),
    supabase
      .from('aprovacoes_cliente')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('decidido_por_portal_cliente_id', clientId)
      .eq('status', 'rejeitado'),
  ])

  const firstError =
    sessionsRes.error ||
    commentsRes.error ||
    totalCommentsRes.error ||
    clientCommentsRes.error ||
    decisionsRes.error ||
    totalDecisionsRes.error ||
    approvedDecisionsRes.error ||
    rejectedDecisionsRes.error

  if (firstError) {
    throw new Error(firstError.message)
  }

  const sessions = ((sessionsRes.data || []) as unknown) as PortalSessionRow[]
  const recentComments = ((commentsRes.data || []) as unknown) as CommentRow[]
  const recentDecisions = ((decisionsRes.data || []) as unknown) as ApprovalRow[]
  const recentPendingApprovals: PendingApprovalRow[] = []

  let activeSessions = 0
  let expiredSessions = 0
  let revokedSessions = 0
  let latestAccessAt: string | null = null

  const recentSessions = sessions.slice(0, 8).map<PortalAdminObraSessionActivityItem>((session) => {
    const status = resolveSessionStatus(session)
    if (status === 'active') activeSessions += 1
    if (status === 'expired') expiredSessions += 1
    if (status === 'revoked') revokedSessions += 1
    if (!latestAccessAt || (session.last_accessed_at && session.last_accessed_at > latestAccessAt)) {
      latestAccessAt = session.last_accessed_at
    }
    return {
      id: session.id,
      portal_cliente_id: clientId,
      portal_cliente_nome: clientData.nome,
      portal_cliente_email: clientData.email,
      status,
      created_at: session.created_at,
      expires_at: session.expires_at,
      revoked_at: session.revoked_at,
      last_accessed_at: session.last_accessed_at,
    }
  })

  const latestSession = sessions[0] ? toSessionSummary(sessions[0]) : null
  const client: PortalAdminObraClientActivityItem = {
    id: clientData.id,
    nome: clientData.nome,
    email: clientData.email,
    telefone: clientData.telefone,
    ativo: clientData.ativo,
    created_at: clientData.created_at,
    updated_at: clientData.updated_at,
    total_sessions: sessions.length,
    never_activated: sessions.length === 0,
    last_invite_at: sessions[0]?.created_at || null,
    last_accessed_at: latestAccessAt,
    latest_comment_at: recentComments[0]?.created_at || null,
    latest_comment_origin: recentComments[0]?.origem || null,
    latest_comment_preview: recentComments[0]?.mensagem || null,
    follow_up_state: resolveFollowUpState(recentComments[0]?.origem || null),
    latest_session: latestSession,
  }

  const totalComments = totalCommentsRes.count || 0
  const clientComments = clientCommentsRes.count || 0

  return {
    client,
    summary: {
      totalSessions: sessions.length,
      activeSessions,
      expiredSessions,
      revokedSessions,
      totalComments,
      clientComments,
      internalComments: Math.max(0, totalComments - clientComments),
      totalDecisions: totalDecisionsRes.count || 0,
      approvedDecisions: approvedDecisionsRes.count || 0,
      rejectedDecisions: rejectedDecisionsRes.count || 0,
      pendingAssignedApprovals: 0,
      overduePendingApprovals: 0,
      followUpState: resolveFollowUpState(recentComments[0]?.origem || null),
      latestAccessAt,
      latestCommentAt: recentComments[0]?.created_at || null,
      latestCommentOrigin: recentComments[0]?.origem || null,
      latestDecisionAt: recentDecisions[0]?.decidido_em || null,
      nextPendingSlaAt: null,
    },
    recentSessions,
    recentComments,
    recentDecisions,
    recentPendingApprovals,
  }
}
