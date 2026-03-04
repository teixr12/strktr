import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { updateVisitSchema } from '@/shared/schemas/construction-docs'
import { ensureVisitOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'
import { resolveDownloadUrl } from '@/server/services/construction-docs/storage-service'

const DEFAULT_MEDIA_BUCKET = 'construction-docs-media'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId }) => {
    const { visitId } = await params
    const visit = await ensureVisitOwnership(supabase, orgId, visitId)
    if (!visit) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Visita não encontrada' },
        404
      )
    }

    const [{ data: rooms }, { data: photos }] = await Promise.all([
      supabase
        .from('construction_docs_rooms')
        .select('id, org_id, visit_id, name, sort_order, created_at, updated_at')
        .eq('org_id', orgId)
        .eq('visit_id', visitId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('construction_docs_photos')
        .select('id, org_id, visit_id, room_id, storage_key, url, thumbnail_key, metadata, created_by, created_at, updated_at')
        .eq('org_id', orgId)
        .eq('visit_id', visitId)
        .order('created_at', { ascending: true }),
    ])

    const photoIds = (photos || []).map((photo) => photo.id)
    const { data: annotations } =
      photoIds.length > 0
        ? await supabase
            .from('construction_docs_annotations')
            .select('id, org_id, photo_id, type, geometry, text, created_by, created_at, updated_at')
            .eq('org_id', orgId)
            .in('photo_id', photoIds)
            .order('created_at', { ascending: true })
        : { data: [] }

    const photosWithSignedUrl = await Promise.all(
      (photos || []).map(async (photo) => {
        const metadata = photo.metadata && typeof photo.metadata === 'object' ? photo.metadata : {}
        const bucket =
          typeof (metadata as Record<string, unknown>).bucket === 'string'
            ? ((metadata as Record<string, unknown>).bucket as string)
            : DEFAULT_MEDIA_BUCKET
        const signedUrl = await resolveDownloadUrl(supabase, bucket, photo.storage_key)
        return {
          ...photo,
          signed_url: signedUrl || photo.url || null,
        }
      })
    )

    const photosWithAnnotations = photosWithSignedUrl.map((photo) => ({
      ...photo,
      annotations: (annotations || []).filter((annotation) => annotation.photo_id === photo.id),
    }))

    return ok(
      innerRequest,
      {
        visit,
        rooms: rooms || [],
        photos: photosWithAnnotations,
      },
      getConstructionDocsFlagMeta()
    )
  })

  return handler(request)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = updateVisitSchema.safeParse(await innerRequest.json().catch(() => null))
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

    const { visitId } = await params
    const existing = await ensureVisitOwnership(supabase, orgId, visitId)
    if (!existing) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Visita não encontrada' },
        404
      )
    }

    const { data: updated, error } = await supabase
      .from('construction_docs_visits')
      .update({
        ...parsed.data,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('id', visitId)
      .select('id, org_id, project_link_id, type, visit_date, metadata, created_by, created_at, updated_at')
      .single()

    if (error || !updated) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.DB_ERROR,
          message: error?.message || 'Não foi possível atualizar visita',
        },
        500
      )
    }

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'visit_updated',
      visitId,
      payload: parsed.data,
    }).catch(() => undefined)

    return ok(innerRequest, updated, getConstructionDocsFlagMeta())
  })

  return handler(request)
}
