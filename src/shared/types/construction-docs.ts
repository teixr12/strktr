export type ConstructionVisitType = 'PRE' | 'POST'
export type ConstructionDocType = 'INSPECTION' | 'SOP' | 'SCHEDULE'
export type ConstructionDocStatus = 'DRAFT' | 'FINAL'
export type ConstructionAnnotationType = 'arrow' | 'rect' | 'text'

export interface ConstructionDocsProjectLink {
  id: string
  org_id: string
  project_id: string
  obra_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ConstructionDocsVisit {
  id: string
  org_id: string
  project_link_id: string
  type: ConstructionVisitType
  visit_date: string
  metadata: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export interface ConstructionDocsRoom {
  id: string
  org_id: string
  visit_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ConstructionDocsPhoto {
  id: string
  org_id: string
  visit_id: string
  room_id: string | null
  storage_key: string
  url: string
  signed_url?: string | null
  thumbnail_key: string | null
  metadata: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export interface ConstructionDocsAnnotation {
  id: string
  org_id: string
  photo_id: string
  type: ConstructionAnnotationType
  geometry: Record<string, unknown>
  text: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type ConstructionTemplateBlockType =
  | 'header'
  | 'section'
  | 'text'
  | 'table'
  | 'photo-grid'
  | 'signature'

export interface ConstructionTemplateBlock {
  id: string
  type: ConstructionTemplateBlockType
  props: Record<string, unknown>
}

export interface ConstructionDocsTemplateDSL {
  version: number
  blocks: ConstructionTemplateBlock[]
}

export interface ConstructionDocsTemplate {
  id: string
  org_id: string
  doc_type: ConstructionDocType
  name: string
  dsl: ConstructionDocsTemplateDSL
  version: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface ConstructionDocsDocument {
  id: string
  org_id: string
  project_id: string
  obra_id: string | null
  type: ConstructionDocType
  status: ConstructionDocStatus
  payload: Record<string, unknown>
  rendered_html: string | null
  pdf_key: string | null
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ConstructionDocsShareLink {
  id: string
  org_id: string
  document_id: string
  expires_at: string
  revoked_at: string | null
  created_by: string
  created_at: string
}

export interface InspectionReportPayload {
  summary: string
  findings: string[]
  recommendations: string[]
  generatedAt: string
}

export interface ScheduleTaskPayload {
  id: string
  title: string
  startsAt: string
  endsAt: string
  dependsOn: string[]
}

export interface SchedulePayload {
  summary: string
  tasks: ScheduleTaskPayload[]
  generatedAt: string
}

export interface ShareLinkAccessResult {
  document: Pick<ConstructionDocsDocument, 'id' | 'type' | 'status' | 'payload' | 'rendered_html' | 'updated_at'>
  expiresAt: string
}

export interface ConstructionDocsPdfPayload {
  fileName: string
  mimeType: 'application/pdf'
  bytes: number
  downloadUrl: string | null
  base64: string | null
  fallback: boolean
}
