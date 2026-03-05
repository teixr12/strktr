export type DocsWorkspaceItemKind =
  | 'legacy_sop'
  | 'construction_document'
  | 'visit'
  | 'template'

export type DocsWorkspaceSourceModule = 'sops' | 'construction_docs'

export interface DocsWorkspaceItem {
  id: string
  kind: DocsWorkspaceItemKind
  source_module: DocsWorkspaceSourceModule
  title: string
  subtitle: string | null
  description: string | null
  href: string
  status: string | null
  project_id: string | null
  project_name: string | null
  obra_id: string | null
  obra_name: string | null
  created_at: string
  updated_at: string
}

export interface DocsWorkspacePayload {
  items: DocsWorkspaceItem[]
}
