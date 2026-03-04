import { z } from 'zod'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import {
  createAnnotationSchema,
  updateAnnotationSchema,
} from '@/shared/schemas/construction-docs'
import { ensurePhotoOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'

const annotationIdSchema = z.object({
  annotation_id: z.string().uuid(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = createAnnotationSchema.safeParse(await innerRequest.json().catch(() => null))
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

    const { photoId } = await params
    const photo = await ensurePhotoOwnership(supabase, orgId, photoId)
    if (!photo) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Foto não encontrada' },
        404
      )
    }

    const { data, error } = await supabase
      .from('construction_docs_annotations')
      .insert({
        org_id: orgId,
        photo_id: photoId,
        type: parsed.data.type,
        geometry: parsed.data.geometry,
        text: parsed.data.text || null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .select('id, org_id, photo_id, type, geometry, text, created_by, created_at, updated_at')
      .single()

    if (error || !data) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Erro ao criar anotação' },
        500
      )
    }

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'annotation_created',
      visitId: photo.visit_id,
      payload: {
        annotation_id: data.id,
      },
    }).catch(() => undefined)

    return ok(innerRequest, data, getConstructionDocsFlagMeta(), 201)
  })

  return handler(request)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const payload = await innerRequest.json().catch(() => null)
    const parsedId = annotationIdSchema.safeParse(payload)
    const parsedChanges = updateAnnotationSchema.safeParse(payload)

    if (!parsedId.success || !parsedChanges.success) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message:
            parsedId.error?.issues[0]?.message ||
            parsedChanges.error?.issues[0]?.message ||
            'Payload inválido',
        },
        400
      )
    }

    const { photoId } = await params
    const photo = await ensurePhotoOwnership(supabase, orgId, photoId)
    if (!photo) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Foto não encontrada' },
        404
      )
    }

    const { data: existing } = await supabase
      .from('construction_docs_annotations')
      .select('id')
      .eq('org_id', orgId)
      .eq('photo_id', photoId)
      .eq('id', parsedId.data.annotation_id)
      .maybeSingle()

    if (!existing) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Anotação não encontrada' },
        404
      )
    }

    const { data, error } = await supabase
      .from('construction_docs_annotations')
      .update({
        ...parsedChanges.data,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('photo_id', photoId)
      .eq('id', parsedId.data.annotation_id)
      .select('id, org_id, photo_id, type, geometry, text, created_by, created_at, updated_at')
      .single()

    if (error || !data) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Erro ao atualizar anotação' },
        500
      )
    }

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'annotation_updated',
      visitId: photo.visit_id,
      payload: {
        annotation_id: data.id,
      },
    }).catch(() => undefined)

    return ok(innerRequest, data, getConstructionDocsFlagMeta())
  })

  return handler(request)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = annotationIdSchema.safeParse(await innerRequest.json().catch(() => null))
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

    const { photoId } = await params
    const photo = await ensurePhotoOwnership(supabase, orgId, photoId)
    if (!photo) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Foto não encontrada' },
        404
      )
    }

    const { data: deleted, error } = await supabase
      .from('construction_docs_annotations')
      .delete()
      .eq('org_id', orgId)
      .eq('photo_id', photoId)
      .eq('id', parsed.data.annotation_id)
      .select('id')
      .maybeSingle()

    if (error) {
      return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
    }

    if (!deleted) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Anotação não encontrada' },
        404
      )
    }

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'annotation_deleted',
      visitId: photo.visit_id,
      payload: {
        annotation_id: parsed.data.annotation_id,
      },
    }).catch(() => undefined)

    return ok(innerRequest, { success: true }, getConstructionDocsFlagMeta())
  })

  return handler(request)
}
