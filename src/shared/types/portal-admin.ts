export type PortalSessionStatus = 'active' | 'expired' | 'revoked' | 'none'

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

