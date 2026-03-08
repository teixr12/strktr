import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withPublicApiAuth } from '@/lib/public-api/api'
import { getPublicApiClientUsage } from '@/server/services/public-api/client-usage'
import type { PublicApiClientProfile } from '@/shared/types/public-api'

function resolveClientId(request: Request): string | null {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  const clientsIndex = segments.findIndex((segment) => segment === 'clients')
  const id = clientsIndex >= 0 ? segments[clientsIndex + 1] : null
  return id?.trim() || null
}

export const GET = withPublicApiAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const clientId = resolveClientId(request)
  if (!clientId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'id inválido' }, 400)
  }

  const { data: client, error: clientError } = await supabase
    .from('public_api_clients')
    .select('id, rate_limit_per_minute, daily_quota, monthly_call_budget')
    .eq('id', clientId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (clientError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: clientError.message }, 500)
  }
  if (!client) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Cliente de API não encontrado' }, 404)
  }

  const usage = await getPublicApiClientUsage(
    supabase,
    orgId,
    client as Pick<PublicApiClientProfile, 'id' | 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>
  )
  if (usage.error || !usage.payload) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: usage.error?.message || 'Falha ao carregar uso do cliente' },
      500
    )
  }

  return ok(request, usage.payload)
})
