export type AgentReadySurfaceCategory = 'context' | 'actions' | 'security' | 'observability' | 'connectors'
export type AgentReadyExposureState = 'internal_only' | 'setup_required' | 'planned' | 'beta_ready'
export type AgentReadyChecklistStatus = 'ready' | 'blocked' | 'planned'
export type AgentReadyScopeLevel = 'read' | 'write' | 'admin'
export type AgentReadyRollout = 'internal_only' | 'beta' | 'general_blocked'
export type AgentReadyActionKind = 'read' | 'write' | 'generate' | 'sync'
export type AgentReadyProfileType = 'internal_assistant' | 'external_llm' | 'workflow_agent' | 'human_proxy'
export type AgentReadyProfileStatus = 'draft' | 'active' | 'paused' | 'revoked'

export interface AgentReadySurface {
  code: string
  label: string
  description: string
  category: AgentReadySurfaceCategory
  riskLevel: 'medium' | 'high'
  exposureState: AgentReadyExposureState
  complianceGated: boolean
  recommendedAction: string
}

export interface AgentReadyChecklistItem {
  key: string
  label: string
  status: AgentReadyChecklistStatus
  detail: string
}

export interface AgentReadyScopeDefinition {
  code: string
  label: string
  description: string
  level: AgentReadyScopeLevel
  domains: string[]
  rollout: AgentReadyRollout
}

export interface AgentReadyActionDefinition {
  code: string
  label: string
  description: string
  domain: string
  kind: AgentReadyActionKind
  riskLevel: 'medium' | 'high'
  requiredScopes: string[]
  rollout: AgentReadyRollout
}

export interface AgentReadyProfile {
  id: string
  org_id: string
  name: string
  agent_type: AgentReadyProfileType
  status: AgentReadyProfileStatus
  scope_codes: string[]
  action_codes: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AgentReadyProfileSummary {
  total: number
  draft: number
  active: number
  paused: number
  revoked: number
}

export interface AgentReadySummary {
  totalSurfaces: number
  internalOnly: number
  betaReady: number
  setupRequired: number
  planned: number
  complianceGated: number
  checklistReady: number
  checklistBlocked: number
}
