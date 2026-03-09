import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withPublicApiAuth } from '@/lib/public-api/api'
import { getPublicApiClientTokenUsage } from '@/server/services/public-api/client-usage'
import type { PublicApiClientProfile, PublicApiClientToken } from '@/shared/types/public-api'

function resolveIds(request: Request) {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  const clientsIndex = segments.findIndex((segment) => segment === 'clients')
  const tokensIndex = segments.findIndex((segment) => segment === 'tokens')

  return {
    clientId: clientsIndex >= 0 ? segments[clientsIndex + 1]?.trim() || null : null,
    tokenId: tokensIndex >= 0 ? segments[tokensIndex + 1]?.trim() || null : null,
  }
}

export const GET = withPublicApiAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const { clientId, tokenId } = resolveIds(request)
  if (!clientId || !tokenId) {
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

  const { data: token, error: tokenError } = await supabase
    .from('public_api_client_tokens')
    .select('id, rate_limit_per_minute_override, daily_quota_override, monthly_call_budget_override')
    .eq('id', tokenId)
    .eq('client_id', clientId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (tokenError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: tokenError.message }, 500)
  }
  if (!token) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Token de API não encontrado' }, 404)
  }

  const usage = await getPublicApiClientTokenUsage(
    supabase,
    orgId,
    client as Pick<PublicApiClientProfile, 'id' | 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>,
    token as Pick<
      PublicApiClientToken,
      'id' | 'rate_limit_per_minute_override' | 'daily_quota_override' | 'monthly_call_budget_override'
    >
  )
  if (usage.error || !usage.payload) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: usage.error?.message || 'Falha ao carregar uso do token' },
      500
    )
  }

  return ok(request, usage.payload)
})
