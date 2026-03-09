export type EmailTriageSource = 'manual' | 'forwarded' | 'integration'

export type EmailTriageClassification =
  | 'lead'
  | 'supplier'
  | 'client'
  | 'operations'
  | 'spam'
  | 'unknown'

export type EmailTriageStatus = 'new' | 'reviewing' | 'qualified' | 'ignored' | 'archived'

export interface EmailTriageRecord {
  id: string
  org_id: string
  source: EmailTriageSource
  sender_name: string | null
  sender_email: string
  subject: string
  snippet: string | null
  classification: EmailTriageClassification
  status: EmailTriageStatus
  lead_id: string | null
  lead_nome: string | null
  received_at: string
  reviewed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EmailTriageSummary {
  total: number
  unreviewed: number
  leadCandidates: number
  supplierCandidates: number
  spam: number
  linkedLeads: number
}

export interface EmailTriageLeadOption {
  id: string
  nome: string
}
