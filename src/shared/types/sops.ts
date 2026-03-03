export type SopStatus = 'draft' | 'published' | 'archived'
export type SopBlockType = 'title' | 'text' | 'image'

export interface SopBlock {
  id: string
  type: SopBlockType
  content: string
}

export interface SopBranding {
  company_name?: string | null
  company_document?: string | null
  responsible_name?: string | null
  logo_url?: string | null
}

export interface SopRecord {
  id: string
  org_id: string
  created_by: string
  obra_id: string | null
  projeto_id: string | null
  title: string
  description: string | null
  status: SopStatus
  blocks: SopBlock[]
  branding: SopBranding
  created_at: string
  updated_at: string
}

export interface SopPdfPayload {
  fileName: string
  mimeType: 'application/pdf'
  bytes: number
  downloadUrl: string | null
  storagePath: string | null
  storageBucket: string | null
  base64: string | null
  fallback: boolean
}
