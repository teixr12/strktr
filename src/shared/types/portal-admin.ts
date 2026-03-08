export type PortalSessionStatus = 'active' | 'expired' | 'revoked' | 'none'
export type PortalCommentFollowUpState = 'awaiting_internal' | 'awaiting_client' | 'idle'

export interface PortalAdminSettings {
  id: string | null
  org_id: string
  obra_id: string
  branding_nome: string | null
  branding_logo_url: string | null
  branding_cor_primaria: string
  mensagem_boas_vindas: string | null
  notificar_por_email: boolean
  created_at: string | null
  updated_at: string | null
}

export interface PortalAdminSessionSummary {
  id: string
  status: PortalSessionStatus
  expires_at: string
  revoked_at: string | null
  created_at: string
  last_accessed_at: string | null
}

export interface PortalAdminClient {
  id: string
  nome: string
  email: string
  telefone: string | null
  ativo: boolean
  created_at: string
  updated_at: string
  latest_session: PortalAdminSessionSummary | null
}

export interface PortalAdminSettingsPayload {
  obra: {
    id: string
    nome: string
    cliente: string
    status: string
  }
  settings: PortalAdminSettings
  clients: PortalAdminClient[]
}

export interface PortalAdminRegenerateInviteResult {
  portalClienteId: string
  sessionId: string
  expiresAt: string
  portalUrl: string
  emailSent: boolean
}

export interface PortalAdminOverviewItem {
  obra_id: string
  obra_nome: string
  cliente: string
  obra_status: string
  obra_updated_at: string
  branding_nome: string | null
  branding_cor_primaria: string | null
  notificar_por_email: boolean
  total_clients: number
  active_clients: number
  active_sessions: number
  expired_sessions: number
  revoked_sessions: number
  never_activated: number
  pending_approvals: number
  overdue_pending_approvals: number
  clients_awaiting_internal_reply: number
  clients_awaiting_client_reply: number
  latest_portal_activity_at: string | null
  last_session_created_at: string | null
  last_session_expires_at: string | null
}

export interface PortalAdminOverviewSummary {
  totalObras: number
  configuredObras: number
  obrasWithoutPortal: number
  totalClients: number
  activeClients: number
  activeSessions: number
  emailEnabledObras: number
  pendingApprovals: number
  overduePendingApprovals: number
  clientsAwaitingInternalReply: number
  clientsAwaitingClientReply: number
}

export interface PortalAdminOverviewPayload {
  items: PortalAdminOverviewItem[]
  summary: PortalAdminOverviewSummary
}

export interface PortalAdminObraApprovalItem {
  id: string
  tipo: string
  status: string
  solicitado_em: string | null
  sla_due_at: string | null
  decisao_comentario: string | null
}

export interface PortalAdminObraCommentItem {
  id: string
  origem: string
  mensagem: string
  created_at: string
}

export interface PortalAdminObraOverviewSummary {
  pendingApprovals: number
  overduePendingApprovals: number
  approvedApprovals: number
  rejectedApprovals: number
  totalComments: number
  clientComments: number
  internalComments: number
  latestApprovalAt: string | null
  latestCommentAt: string | null
  nextPendingSlaAt: string | null
}

export interface PortalAdminObraOverviewPayload {
  summary: PortalAdminObraOverviewSummary
  recentApprovals: PortalAdminObraApprovalItem[]
  recentComments: PortalAdminObraCommentItem[]
}

export interface PortalAdminObraClientActivityItem {
  id: string
  nome: string
  email: string
  telefone: string | null
  ativo: boolean
  created_at: string
  updated_at: string
  total_sessions: number
  never_activated: boolean
  last_invite_at: string | null
  last_accessed_at: string | null
  latest_comment_at: string | null
  latest_comment_origin: string | null
  latest_comment_preview: string | null
  follow_up_state: PortalCommentFollowUpState
  latest_session: PortalAdminSessionSummary | null
}

export interface PortalAdminObraSessionActivityItem {
  id: string
  portal_cliente_id: string
  portal_cliente_nome: string
  portal_cliente_email: string
  status: PortalSessionStatus
  created_at: string
  expires_at: string
  revoked_at: string | null
  last_accessed_at: string | null
}

export interface PortalAdminObraActivitySummary {
  totalClients: number
  activeClients: number
  activeSessions: number
  expiredSessions: number
  revokedSessions: number
  neverActivated: number
  totalSessions: number
  recentlyAccessedClients: number
  clientsAwaitingInternalReply: number
  clientsAwaitingClientReply: number
  latestInviteAt: string | null
  latestAccessAt: string | null
}

export interface PortalAdminObraActivityPayload {
  summary: PortalAdminObraActivitySummary
  clients: PortalAdminObraClientActivityItem[]
  recentSessions: PortalAdminObraSessionActivityItem[]
}

export interface PortalAdminClientDecisionItem {
  id: string
  tipo: string
  status: string
  solicitado_em: string | null
  decidido_em: string | null
  decisao_comentario: string | null
}

export interface PortalAdminClientPendingApprovalItem {
  id: string
  tipo: string
  status: string
  solicitado_em: string | null
  sla_due_at: string | null
  decisao_comentario: string | null
}

export interface PortalAdminClientCommentItem {
  id: string
  origem: string
  mensagem: string
  created_at: string
}

export interface PortalAdminClientActivitySummary {
  totalSessions: number
  activeSessions: number
  expiredSessions: number
  revokedSessions: number
  totalComments: number
  clientComments: number
  internalComments: number
  totalDecisions: number
  approvedDecisions: number
  rejectedDecisions: number
  pendingAssignedApprovals: number
  overduePendingApprovals: number
  followUpState: PortalCommentFollowUpState
  latestAccessAt: string | null
  latestCommentAt: string | null
  latestCommentOrigin: string | null
  latestDecisionAt: string | null
  nextPendingSlaAt: string | null
}

export interface PortalAdminClientActivityPayload {
  client: PortalAdminObraClientActivityItem
  summary: PortalAdminClientActivitySummary
  recentSessions: PortalAdminObraSessionActivityItem[]
  recentComments: PortalAdminClientCommentItem[]
  recentDecisions: PortalAdminClientDecisionItem[]
  recentPendingApprovals: PortalAdminClientPendingApprovalItem[]
}

export interface PortalAdminProjectInfo {
  id: string
  nome: string
  cliente: string | null
  status: string | null
  obra_id: string | null
}

export interface PortalAdminProjectLinkedObra {
  id: string
  nome: string
  cliente: string | null
  status: string | null
}

export interface PortalAdminProjectOverviewPayload {
  projeto: PortalAdminProjectInfo
  linkedObra: PortalAdminProjectLinkedObra | null
  overview: PortalAdminObraOverviewPayload | null
  activity: PortalAdminObraActivityPayload | null
}
