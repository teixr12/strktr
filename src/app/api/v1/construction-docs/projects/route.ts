import { API_ERROR_CODES } from '@/lib/api/errors'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import type { ConstructionDocsProjectIndexPayload } from '@/shared/types/construction-docs-projects'

function sanitizeLikeTerm(value: string): string {
  return value.replace(/[%_]/g, '').trim()
}

export async function GET(request: Request) {
  const handler = withConstructionDocsAuth(
    'can_manage_projects',
    async (innerRequest, { supabase, orgId }) => {
      const { searchParams } = new URL(innerRequest.url)
      const queryTerm = sanitizeLikeTerm(searchParams.get('q') || '')
      const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
        defaultPageSize: 24,
        maxPageSize: 100,
      })

      let projectQuery = supabase
        .from('projetos')
        .select('id, nome, status, cliente, local, obra_id, updated_at', { count: 'exact' })
        .eq('org_id', orgId)

      if (queryTerm.length >= 2) {
        projectQuery = projectQuery.ilike('nome', `%${queryTerm}%`)
      }

      const { data: projects, count, error: projectsError } = await projectQuery
        .order('updated_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (projectsError) {
        return fail(
          innerRequest,
          { code: API_ERROR_CODES.DB_ERROR, message: projectsError.message },
          500
        )
      }

      const safeProjects = projects || []
      const total = count ?? safeProjects.length
      const projectIds = safeProjects.map((project) => project.id)

      if (projectIds.length === 0) {
        return ok(
          innerRequest,
          { items: [] } satisfies ConstructionDocsProjectIndexPayload,
          {
            ...getConstructionDocsFlagMeta(),
            pagination: buildPaginationMeta(0, total, page, pageSize),
          }
        )
      }

      const { data: links, error: linksError } = await supabase
        .from('construction_docs_project_links')
        .select('id, project_id')
        .eq('org_id', orgId)
        .in('project_id', projectIds)

      if (linksError) {
        return fail(
          innerRequest,
          { code: API_ERROR_CODES.DB_ERROR, message: linksError.message },
          500
        )
      }

      const linkByProjectId = new Map((links || []).map((link) => [link.project_id, link]))
      const linkIds = (links || []).map((link) => link.id)

      const [visitsRes, docsRes] = await Promise.all([
        linkIds.length > 0
          ? supabase
              .from('construction_docs_visits')
              .select('id, project_link_id, visit_date')
              .eq('org_id', orgId)
              .in('project_link_id', linkIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('construction_docs_documents')
          .select('id, project_id, updated_at')
          .eq('org_id', orgId)
          .in('project_id', projectIds),
      ])

      if (visitsRes.error) {
        return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: visitsRes.error.message }, 500)
      }
      if (docsRes.error) {
        return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: docsRes.error.message }, 500)
      }

      const visitsByLinkId = new Map<string, number>()
      const latestVisitByLinkId = new Map<string, string>()
      for (const visit of visitsRes.data || []) {
        visitsByLinkId.set(visit.project_link_id, (visitsByLinkId.get(visit.project_link_id) || 0) + 1)
        const currentLatest = latestVisitByLinkId.get(visit.project_link_id)
        if (!currentLatest || visit.visit_date > currentLatest) {
          latestVisitByLinkId.set(visit.project_link_id, visit.visit_date)
        }
      }

      const docsCountByProjectId = new Map<string, number>()
      const latestDocByProjectId = new Map<string, string>()
      for (const document of docsRes.data || []) {
        docsCountByProjectId.set(
          document.project_id,
          (docsCountByProjectId.get(document.project_id) || 0) + 1
        )
        const currentLatest = latestDocByProjectId.get(document.project_id)
        if (!currentLatest || document.updated_at > currentLatest) {
          latestDocByProjectId.set(document.project_id, document.updated_at)
        }
      }

      const items: ConstructionDocsProjectIndexPayload['items'] = safeProjects.map((project) => {
        const link = linkByProjectId.get(project.id)
        const visitsCount = link ? visitsByLinkId.get(link.id) || 0 : 0
        const documentsCount = docsCountByProjectId.get(project.id) || 0

        return {
          project_id: project.id,
          nome: project.nome || 'Projeto sem nome',
          status: project.status || null,
          cliente: project.cliente || null,
          local: project.local || null,
          obra_id: project.obra_id || null,
          project_link_id: link?.id || null,
          has_setup: Boolean(link),
          visits_count: visitsCount,
          documents_count: documentsCount,
          latest_visit_date: link ? latestVisitByLinkId.get(link.id) || null : null,
          latest_document_at: latestDocByProjectId.get(project.id) || null,
        }
      })

      return ok(
        innerRequest,
        { items } satisfies ConstructionDocsProjectIndexPayload,
        {
          ...getConstructionDocsFlagMeta(),
          pagination: buildPaginationMeta(items.length, total, page, pageSize),
        }
      )
    }
  )

  return handler(request)
}
