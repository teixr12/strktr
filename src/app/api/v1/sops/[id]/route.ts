import { withApiAuth } from '@/lib/api/with-auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { emitProductEvent } from '@/lib/telemetry'
import { updateSopSchema } from '@/shared/schemas/sops'
import type { SopRecord } from '@/shared/types/sops'

async function getSopById(
  supabase: Parameters<Parameters<typeof withApiAuth>[1]>[1]['supabase'],
  orgId: string,
  sopId: string
) {
  return supabase
    .from('sops')
    .select(
      'id, org_id, created_by, obra_id, projeto_id, title, description, status, blocks, branding, created_at, updated_at'
    )
    .eq('org_id', orgId)
    .eq('id', sopId)
    .maybeSingle()
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = withApiAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const parsed = updateSopSchema.safeParse(await innerRequest.json().catch(() => null))
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

    const { id } = await params
    const { data: current, error: currentError } = await getSopById(supabase, orgId, id)
    if (currentError) {
      return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: currentError.message }, 500)
    }
    if (!current) {
      return fail(innerRequest, { code: API_ERROR_CODES.NOT_FOUND, message: 'SOP não encontrado' }, 404)
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.obra_id !== undefined) updates.obra_id = parsed.data.obra_id
    if (parsed.data.projeto_id !== undefined) updates.projeto_id = parsed.data.projeto_id
    if (parsed.data.title !== undefined) updates.title = parsed.data.title
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.status !== undefined) updates.status = parsed.data.status
    if (parsed.data.blocks !== undefined) updates.blocks = parsed.data.blocks
    if (parsed.data.branding !== undefined) updates.branding = parsed.data.branding

    const { data, error } = await supabase
      .from('sops')
      .update(updates)
      .eq('org_id', orgId)
      .eq('id', id)
      .select(
        'id, org_id, created_by, obra_id, projeto_id, title, description, status, blocks, branding, created_at, updated_at'
      )
      .single()

    if (error || !data) {
      return fail(
        innerRequest,
        { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Erro ao atualizar SOP' },
        500
      )
    }

    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'core_edit',
      entityType: 'sop',
      entityId: id,
      payload: { previous_status: current.status, status: data.status, source: 'web' },
      mirrorExternal: true,
    }).catch(() => undefined)

    return ok(innerRequest, data as SopRecord, { flag: 'NEXT_PUBLIC_FF_SOP_BUILDER_V1' })
  })
  return handler(request)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const handler = withApiAuth('can_manage_projects', async (innerRequest, { supabase, orgId, user }) => {
    const { id } = await params
    const { error } = await supabase
      .from('sops')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id)

    if (error) {
      return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
    }

    await emitProductEvent({
      supabase,
      orgId,
      userId: user.id,
      eventType: 'core_delete',
      entityType: 'sop',
      entityId: id,
      payload: { source: 'web' },
      mirrorExternal: true,
    }).catch(() => undefined)

    return ok(innerRequest, { success: true }, { flag: 'NEXT_PUBLIC_FF_SOP_BUILDER_V1' })
  })
  return handler(request)
}
