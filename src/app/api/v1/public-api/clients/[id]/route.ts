import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withPublicApiAuth } from '@/lib/public-api/api'
import { publicApiClientPatchSchema } from '@/shared/schemas/public-api'
import type { PublicApiClientProfile } from '@/shared/types/public-api'

const PUBLIC_API_CLIENT_COLUMNS =
  'id, org_id, name, status, exposure, scope_codes, rate_limit_per_minute, daily_quota, monthly_call_budget, owner_email, notes, created_at, updated_at'

function resolveClientId(request: Request): string | null {
  const pathname = new URL(request.url).pathname
  const id = pathname.split('/').filter(Boolean).at(-1)?.trim() || ''
  return id || null
}

export const PATCH = withPublicApiAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  const id = resolveClientId(request)
  if (!id) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'id inválido' }, 400)
  }
  const parsed = publicApiClientPatchSchema.safeParse(await request.json().catch(() => null))
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

  const updates: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.exposure !== undefined) updates.exposure = parsed.data.exposure
  if (parsed.data.scope_codes !== undefined) updates.scope_codes = parsed.data.scope_codes
  if (parsed.data.rate_limit_per_minute !== undefined) updates.rate_limit_per_minute = parsed.data.rate_limit_per_minute
  if (parsed.data.daily_quota !== undefined) updates.daily_quota = parsed.data.daily_quota
  if (parsed.data.monthly_call_budget !== undefined) updates.monthly_call_budget = parsed.data.monthly_call_budget
  if (parsed.data.owner_email !== undefined) updates.owner_email = parsed.data.owner_email || null
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes || null

  const { data, error } = await supabase
    .from('public_api_clients')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select(PUBLIC_API_CLIENT_COLUMNS)
    .maybeSingle()

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }
  if (!data) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Cliente de API não encontrado' }, 404)
  }

  return ok(request, data as PublicApiClientProfile)
})
