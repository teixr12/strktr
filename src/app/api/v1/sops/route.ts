import { withApiAuth } from '@/lib/api/with-auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { emitProductEvent } from '@/lib/telemetry'
import { createSopSchema } from '@/shared/schemas/sops'
import type { SopRecord } from '@/shared/types/sops'

export const GET = withApiAuth('can_manage_projects', async (request, { supabase, orgId }) => {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || null
  const status = searchParams.get('status')?.trim() || null
  const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 25,
    maxPageSize: 100,
  })

  let query = supabase
    .from('sops')
    .select(
      'id, org_id, created_by, obra_id, projeto_id, title, description, status, blocks, branding, created_at, updated_at',
      { count: 'exact' }
    )
    .eq('org_id', orgId)

  if (status) query = query.eq('status', status)
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)

  const { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const items = (data || []) as SopRecord[]
  const total = count ?? items.length
  return ok(request, items, buildPaginationMeta(items.length, total, page, pageSize))
})

export const POST = withApiAuth('can_manage_projects', async (request, { supabase, orgId, user }) => {
  const parsed = createSopSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message || 'Payload inválido',
      },
      400
    )
  }

  const payload = parsed.data
  const { data, error } = await supabase
    .from('sops')
    .insert({
      org_id: orgId,
      created_by: user.id,
      obra_id: payload.obra_id || null,
      projeto_id: payload.projeto_id || null,
      title: payload.title,
      description: payload.description || null,
      status: payload.status,
      blocks: payload.blocks || [],
      branding: payload.branding || {},
      updated_at: new Date().toISOString(),
    })
    .select(
      'id, org_id, created_by, obra_id, projeto_id, title, description, status, blocks, branding, created_at, updated_at'
    )
    .single()

  if (error || !data) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Erro ao criar SOP' },
      500
    )
  }

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'sop_created',
    entityType: 'sop',
    entityId: data.id,
    payload: { status: data.status, source: 'web' },
    mirrorExternal: true,
  }).catch(() => undefined)

  return ok(request, data as SopRecord, { flag: 'NEXT_PUBLIC_FF_SOP_BUILDER_V1' }, 201)
})
