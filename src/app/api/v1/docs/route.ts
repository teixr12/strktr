import { API_ERROR_CODES } from '@/lib/api/errors'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { fail, ok } from '@/lib/api/response'
import { withDocsWorkspaceAuth } from '@/lib/docs-workspace/api'
import type {
  DocsWorkspaceItem,
  DocsWorkspaceItemKind,
  DocsWorkspacePayload,
} from '@/shared/types/docs-workspace'

type ProjectRecord = {
  id: string
  nome: string | null
}

type ObraRecord = {
  id: string
  nome: string | null
}

type SopListRow = {
  id: string
  obra_id: string | null
  projeto_id: string | null
  title: string
  description: string | null
  status: string
  created_at: string
  updated_at: string
}

type ConstructionDocumentRow = {
  id: string
  project_id: string
  obra_id: string | null
  type: string
  status: string
  created_at: string
  updated_at: string
}

type ConstructionTemplateRow = {
  id: string
  doc_type: string
  name: string
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type ConstructionVisitRow = {
  id: string
  project_link_id: string
  type: string
  visit_date: string
  created_at: string
  updated_at: string
}

type ConstructionProjectLinkRow = {
  id: string
  project_id: string
  obra_id: string | null
}

function normalizeSearchTerm(value: string | null): string {
  return (value || '').trim().toLowerCase()
}

function asValidKind(value: string | null): DocsWorkspaceItemKind | null {
  if (
    value === 'legacy_sop' ||
    value === 'construction_document' ||
    value === 'visit' ||
    value === 'template'
  ) {
    return value
  }
  return null
}

function includesTerm(parts: Array<string | null | undefined>, term: string): boolean {
  if (!term) return true
  return parts.some((part) => (part || '').toLowerCase().includes(term))
}

export const GET = withDocsWorkspaceAuth('can_manage_projects', async (request, { supabase, orgId }) => {
  const { searchParams } = new URL(request.url)
  const term = normalizeSearchTerm(searchParams.get('q'))
  const kind = asValidKind(searchParams.get('kind'))
  const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 24,
    maxPageSize: 100,
  })

  const [sopsRes, docsRes, templatesRes, visitsRes, linksRes] = await Promise.all([
    supabase
      .from('sops')
      .select('id, obra_id, projeto_id, title, description, status, created_at, updated_at')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('construction_docs_documents')
      .select('id, project_id, obra_id, type, status, created_at, updated_at')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('construction_docs_templates')
      .select('id, doc_type, name, version, is_active, created_at, updated_at')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('construction_docs_visits')
      .select('id, project_link_id, type, visit_date, created_at, updated_at')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('construction_docs_project_links')
      .select('id, project_id, obra_id')
      .eq('org_id', orgId),
  ])

  const firstError =
    sopsRes.error || docsRes.error || templatesRes.error || visitsRes.error || linksRes.error
  if (firstError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: firstError.message }, 500)
  }

  const links = (linksRes.data || []) as ConstructionProjectLinkRow[]
  const linkById = new Map(links.map((link) => [link.id, link]))

  const projectIds = new Set<string>()
  const obraIds = new Set<string>()

  for (const sop of (sopsRes.data || []) as SopListRow[]) {
    if (sop.projeto_id) projectIds.add(sop.projeto_id)
    if (sop.obra_id) obraIds.add(sop.obra_id)
  }

  for (const document of (docsRes.data || []) as ConstructionDocumentRow[]) {
    projectIds.add(document.project_id)
    if (document.obra_id) obraIds.add(document.obra_id)
  }

  for (const link of links) {
    projectIds.add(link.project_id)
    if (link.obra_id) obraIds.add(link.obra_id)
  }

  const projectIdList = Array.from(projectIds)
  const obraIdList = Array.from(obraIds)

  const [projectsRes, obrasRes] = await Promise.all([
    projectIdList.length > 0
      ? supabase.from('projetos').select('id, nome').in('id', projectIdList)
      : Promise.resolve({ data: [] as ProjectRecord[], error: null }),
    obraIdList.length > 0
      ? supabase.from('obras').select('id, nome').in('id', obraIdList)
      : Promise.resolve({ data: [] as ObraRecord[], error: null }),
  ])

  if (projectsRes.error || obrasRes.error) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.DB_ERROR,
        message: projectsRes.error?.message || obrasRes.error?.message || 'Erro ao carregar contexto',
      },
      500
    )
  }

  const projectNameById = new Map(
    ((projectsRes.data || []) as ProjectRecord[]).map((project) => [project.id, project.nome || 'Projeto'])
  )
  const obraNameById = new Map(
    ((obrasRes.data || []) as ObraRecord[]).map((obra) => [obra.id, obra.nome || 'Obra'])
  )

  const items: DocsWorkspaceItem[] = []

  for (const sop of (sopsRes.data || []) as SopListRow[]) {
    items.push({
      id: sop.id,
      kind: 'legacy_sop',
      source_module: 'sops',
      title: sop.title,
      subtitle: sop.description,
      description: 'SOP legada do builder atual',
      href: '/sops',
      status: sop.status,
      project_id: sop.projeto_id,
      project_name: sop.projeto_id ? projectNameById.get(sop.projeto_id) || null : null,
      obra_id: sop.obra_id,
      obra_name: sop.obra_id ? obraNameById.get(sop.obra_id) || null : null,
      created_at: sop.created_at,
      updated_at: sop.updated_at,
    })
  }

  for (const document of (docsRes.data || []) as ConstructionDocumentRow[]) {
    items.push({
      id: document.id,
      kind: 'construction_document',
      source_module: 'construction_docs',
      title: `${document.type} · Documento`,
      subtitle: document.project_id ? projectNameById.get(document.project_id) || null : null,
      description: document.obra_id ? obraNameById.get(document.obra_id) || null : 'Sem obra vinculada',
      href: `/construction-docs/documents/${document.id}`,
      status: document.status,
      project_id: document.project_id,
      project_name: projectNameById.get(document.project_id) || null,
      obra_id: document.obra_id,
      obra_name: document.obra_id ? obraNameById.get(document.obra_id) || null : null,
      created_at: document.created_at,
      updated_at: document.updated_at,
    })
  }

  for (const visit of (visitsRes.data || []) as ConstructionVisitRow[]) {
    const link = linkById.get(visit.project_link_id)
    const projectId = link?.project_id || null
    const obraId = link?.obra_id || null

    items.push({
      id: visit.id,
      kind: 'visit',
      source_module: 'construction_docs',
      title: `Visita ${visit.type}`,
      subtitle: projectId ? projectNameById.get(projectId) || null : null,
      description: `Data da visita: ${visit.visit_date}`,
      href: `/construction-docs/visits/${visit.id}`,
      status: visit.type,
      project_id: projectId,
      project_name: projectId ? projectNameById.get(projectId) || null : null,
      obra_id: obraId,
      obra_name: obraId ? obraNameById.get(obraId) || null : null,
      created_at: visit.created_at,
      updated_at: visit.updated_at,
    })
  }

  for (const template of (templatesRes.data || []) as ConstructionTemplateRow[]) {
    items.push({
      id: template.id,
      kind: 'template',
      source_module: 'construction_docs',
      title: template.name,
      subtitle: `Template ${template.doc_type}`,
      description: `Versão ${template.version}${template.is_active ? ' · ativa' : ''}`,
      href: '/construction-docs/templates',
      status: template.is_active ? 'active' : 'inactive',
      project_id: null,
      project_name: null,
      obra_id: null,
      obra_name: null,
      created_at: template.created_at,
      updated_at: template.updated_at,
    })
  }

  const filtered = items
    .filter((item) => (kind ? item.kind === kind : true))
    .filter((item) =>
      includesTerm(
        [
          item.title,
          item.subtitle,
          item.description,
          item.project_name,
          item.obra_name,
          item.status,
        ],
        term
      )
    )
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))

  const paged = filtered.slice(offset, offset + pageSize)

  return ok(
    request,
    { items: paged } satisfies DocsWorkspacePayload,
    {
      flag: 'NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1',
      pagination: buildPaginationMeta(paged.length, filtered.length, page, pageSize),
    }
  )
})
