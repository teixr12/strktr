export interface ConstructionDocsProjectIndexItem {
  project_id: string
  nome: string
  status: string | null
  cliente: string | null
  local: string | null
  obra_id: string | null
  project_link_id: string | null
  has_setup: boolean
  visits_count: number
  documents_count: number
  latest_visit_date: string | null
  latest_document_at: string | null
}

export interface ConstructionDocsProjectIndexPayload {
  items: ConstructionDocsProjectIndexItem[]
}
