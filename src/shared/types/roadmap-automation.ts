export type UserProfileType = 'owner' | 'manager' | 'architect' | 'finance' | 'field'

export type RoadmapStepStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed'

export interface RoadmapAction {
  id: string
  actionCode: string
  title: string
  description: string | null
  status: RoadmapStepStatus
  dueAt: string | null
  sourceModule: string
  profileType: UserProfileType
  priority: 'high' | 'medium' | 'low'
  estimatedMinutes: number
  href: string
  whyItMatters: string
}

export interface RoadmapProgress {
  total: number
  pending: number
  completedToday: number
}

export type AutomationTrigger = 'LeadCreated' | 'ObraCreated' | 'ApprovalRejected'

export interface AutomationRule {
  id: string
  orgId: string
  trigger: AutomationTrigger
  templateCode: string
  enabled: boolean
  requiresReview: boolean
  cooldownHours: number
  createdBy: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface AutomationPreview {
  trigger: AutomationTrigger
  templateCode: string
  requiresReview: boolean
  actions: Array<{
    actionType: string
    actionKey: string
    title: string
    description: string
    risk: 'low' | 'medium' | 'high'
  }>
}

export interface AutomationRunResult {
  runId: string
  status: 'preview' | 'applied' | 'skipped' | 'error' | 'pending_review'
  applied: number
  skipped: number
  errors: number
  requiresReview: boolean
  message: string
}
