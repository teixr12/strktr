import { z } from 'zod'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { emitProductEvent } from '@/lib/telemetry'
import { ensureProjectLink, ensureProjectOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'

const createVisitPayloadSchema = z.object({
  type: z.enum(['PRE', 'POST']).default('PRE'),
  visit_date: z.string().trim().min(10),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  initial_rooms: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        sort_order: z.number().int().min(0).max(5000).default(0),
      })
    )
    .max(50)
    .optional()
    .default([]),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const { projectId } = await params
    const project = await ensureProjectOwnership(supabase, orgId, projectId)
    if (!project) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Projeto não encontrado' },
        404
      )
    }

    const projectLink = await ensureProjectLink(
      supabase,
      orgId,
      projectId,
      user.id,
      project.obra_id || null
    )

    const { searchParams } = new URL(innerRequest.url)
    const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
      defaultPageSize: 25,
      maxPageSize: 100,
    })

    const { data, count, error } = await supabase
      .from('construction_docs_visits')
      .select(
        'id, org_id, project_link_id, type, visit_date, metadata, created_by, created_at, updated_at',
        { count: 'exact' }
      )
      .eq('org_id', orgId)
      .eq('project_link_id', projectLink.id)
      .order('visit_date', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
    }

    const visits = data || []
    const total = count ?? visits.length

    return ok(
      innerRequest,
      {
        projectLink,
        visits,
      },
      {
        ...getConstructionDocsFlagMeta(),
        pagination: buildPaginationMeta(visits.length, total, page, pageSize),
      }
    )
  })

  return handler(request)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = createVisitPayloadSchema.safeParse(await innerRequest.json().catch(() => null))
    if (!parsed.success) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: parsed.error.issues[0]?.message || 'Payload inválido',
        },
        400
      )
    }

    const { projectId } = await params
    const project = await ensureProjectOwnership(supabase, orgId, projectId)
    if (!project) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Projeto não encontrado' },
        404
      )
    }

    const projectLink = await ensureProjectLink(
      supabase,
      orgId,
      projectId,
      user.id,
      project.obra_id || null
    )

    const payload = parsed.data
    const { data: createdVisit, error: visitError } = await supabase
      .from('construction_docs_visits')
      .insert({
        org_id: orgId,
        project_link_id: projectLink.id,
        type: payload.type,
        visit_date: payload.visit_date,
        metadata: payload.metadata || {},
        created_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .select('id, org_id, project_link_id, type, visit_date, metadata, created_by, created_at, updated_at')
      .single()

    if (visitError || !createdVisit) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.DB_ERROR,
          message: visitError?.message || 'Não foi possível criar visita',
        },
        500
      )
    }

    let rooms: Array<{ id: string; name: string; sort_order: number }> = []
    if (payload.initial_rooms.length > 0) {
      const { data: createdRooms, error: roomsError } = await supabase
        .from('construction_docs_rooms')
        .insert(
          payload.initial_rooms.map((room) => ({
            org_id: orgId,
            visit_id: createdVisit.id,
            name: room.name,
            sort_order: room.sort_order,
            updated_at: new Date().toISOString(),
          }))
        )
        .select('id, name, sort_order')

      if (!roomsError && createdRooms) {
        rooms = createdRooms
      }
    }

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'visit_created',
      projectId,
      visitId: createdVisit.id,
      payload: {
        type: createdVisit.type,
        rooms: rooms.length,
      },
    }).catch(() => undefined)

    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'core_create',
      entityType: 'construction_docs_visit',
      entityId: createdVisit.id,
      payload: {
        source: 'web',
        outcome: 'success',
        project_id: projectId,
      },
      mirrorExternal: true,
    }).catch(() => undefined)

    return ok(
      innerRequest,
      {
        visit: createdVisit,
        rooms,
      },
      getConstructionDocsFlagMeta(),
      201
    )
  })

  return handler(request)
}
