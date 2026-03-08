import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withPublicApiAuth } from '@/lib/public-api/api'
import { evaluateQuotaStatus } from '@/server/services/public-api/client-quota'
import { getPublicApiUsageSummaries } from '@/server/services/public-api/client-usage'
import { publicApiClientCreateSchema } from '@/shared/schemas/public-api'
import type { PublicApiClientProfile } from '@/shared/types/public-api'

const PUBLIC_API_CLIENT_COLUMNS =
  'id, org_id, name, status, exposure, scope_codes, rate_limit_per_minute, daily_quota, monthly_call_budget, owner_email, notes, created_at, updated_at'

export const GET = withPublicApiAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { data, error } = await supabase
    .from('public_api_clients')
    .select(PUBLIC_API_CLIENT_COLUMNS)
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const clients = (data || []) as PublicApiClientProfile[]
  const usageSummaries = await getPublicApiUsageSummaries(supabase, orgId, clients)
  if (!usageSummaries.ok) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: usageSummaries.error.message }, 500)
  }

  return ok(
    request,
    clients.map((client) => ({
      ...client,
      usage: usageSummaries.data[client.id],
      quota_status: evaluateQuotaStatus(usageSummaries.data[client.id], client),
    }))
  )
})

export const POST = withPublicApiAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  const parsed = publicApiClientCreateSchema.safeParse(await request.json().catch(() => null))
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

  const { data, error } = await supabase
    .from('public_api_clients')
    .insert({
      org_id: orgId,
      name: parsed.data.name,
      status: 'draft',
      exposure: parsed.data.exposure,
      scope_codes: parsed.data.scope_codes,
      rate_limit_per_minute: parsed.data.rate_limit_per_minute,
      daily_quota: parsed.data.daily_quota,
      monthly_call_budget: parsed.data.monthly_call_budget,
      owner_email: parsed.data.owner_email || null,
      notes: parsed.data.notes || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(PUBLIC_API_CLIENT_COLUMNS)
    .single()

  if (error || !data) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao criar cliente de API' }, 500)
  }

  return ok(request, data as PublicApiClientProfile)
})
