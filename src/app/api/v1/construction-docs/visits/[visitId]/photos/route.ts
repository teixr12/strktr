import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { getConstructionDocsFlagMeta, withConstructionDocsAuth } from '@/lib/construction-docs/api'
import { uploadPhotosSchema } from '@/shared/schemas/construction-docs'
import { ensureVisitOwnership } from '@/server/repositories/construction-docs/repository'
import { appendConstructionAudit } from '@/server/services/construction-docs/audit-service'
import { uploadConstructionPhoto } from '@/server/services/construction-docs/storage-service'

const MAX_FILE_BYTES = 12 * 1024 * 1024

function estimateBase64Bytes(value: string) {
  const payload = value.includes(',') ? value.split(',')[1] : value
  return Math.floor((payload.length * 3) / 4)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ visitId: string }> }
) {
  const handler = withConstructionDocsAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = uploadPhotosSchema.safeParse(await innerRequest.json().catch(() => null))
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
    const visit = await ensureVisitOwnership(supabase, orgId, visitId)
    if (!visit) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.NOT_FOUND, message: 'Visita não encontrada' },
        404
      )
    }

    const roomIds = Array.from(
      new Set(parsed.data.files.map((file) => file.room_id || null).filter(Boolean) as string[])
    )

    if (roomIds.length > 0) {
      const { data: validRooms, error: roomError } = await supabase
        .from('construction_docs_rooms')
        .select('id')
        .eq('org_id', orgId)
        .eq('visit_id', visitId)
        .in('id', roomIds)

      if (roomError) {
        return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: roomError.message }, 500)
      }

      const validSet = new Set((validRooms || []).map((row) => row.id))
      const hasInvalidRoom = roomIds.some((roomId) => !validSet.has(roomId))
      if (hasInvalidRoom) {
        return fail(
          innerRequest,
          {
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: 'Um ou mais ambientes (room_id) são inválidos para esta visita',
          },
          400
        )
      }
    }

    for (const file of parsed.data.files) {
      if (estimateBase64Bytes(file.base64) > MAX_FILE_BYTES) {
        return fail(
          innerRequest,
          {
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: `Arquivo ${file.filename} excede o limite de 12MB`,
          },
          400
        )
      }
    }

    const nowIso = new Date().toISOString()
    const rows: Array<Record<string, unknown>> = []

    for (const file of parsed.data.files) {
      const stored = await uploadConstructionPhoto({
        orgId,
        visitId,
        filename: file.filename,
        mimeType: file.mime_type,
        base64: file.base64,
      })

      if (!stored) {
        return fail(
          innerRequest,
          {
            code: API_ERROR_CODES.DB_ERROR,
            message: `Falha no upload do arquivo ${file.filename}`,
          },
          503
        )
      }

      rows.push({
        org_id: orgId,
        visit_id: visitId,
        room_id: file.room_id || null,
        storage_key: stored.storageKey,
        url: stored.publicUrl,
        thumbnail_key: null,
        metadata: {
          ...(file.metadata || {}),
          mime_type: file.mime_type,
          bucket: stored.bucket,
          filename: file.filename,
        },
        created_by: user.id,
        updated_at: nowIso,
      })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('construction_docs_photos')
      .insert(rows)
      .select('id, org_id, visit_id, room_id, storage_key, url, thumbnail_key, metadata, created_by, created_at, updated_at')

    if (insertError) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.DB_ERROR,
          message: insertError.message,
        },
        500
      )
    }

    await appendConstructionAudit({
      supabase,
      orgId,
      actorUserId: user.id,
      eventType: 'photos_uploaded',
      visitId,
      payload: {
        count: inserted?.length || 0,
      },
    }).catch(() => undefined)

    return ok(
      innerRequest,
      {
        photos: inserted || [],
      },
      getConstructionDocsFlagMeta(),
      201
    )
  })

  return handler(request)
}
