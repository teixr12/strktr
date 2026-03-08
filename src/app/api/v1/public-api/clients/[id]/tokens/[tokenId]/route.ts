import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withPublicApiAuth } from '@/lib/public-api/api'
import { getPublicApiRuntimeStage, isPublicApiWriteEnabled } from '@/lib/public-api/feature'
import { createEffectiveQuotaConfig, resolveTokenQuotaSource } from '@/server/services/public-api/client-quota'
import { publicApiClientTokenPatchSchema } from '@/shared/schemas/public-api'
import type { PublicApiClientProfile, PublicApiClientToken } from '@/shared/types/public-api'

const PUBLIC_API_CLIENT_TOKEN_COLUMNS =
  'id, org_id, client_id, label, status, exposure, token_prefix, token_last_four, rate_limit_per_minute_override, daily_quota_override, monthly_call_budget_override, expires_at, last_used_at, notes, created_at, updated_at'

function resolveIds(request: Request) {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  const clientsIndex = segments.findIndex((segment) => segment === 'clients')
  const tokensIndex = segments.findIndex((segment) => segment === 'tokens')

  return {
    clientId: clientsIndex >= 0 ? segments[clientsIndex + 1]?.trim() || null : null,
    tokenId: tokensIndex >= 0 ? segments[tokensIndex + 1]?.trim() || null : null,
  }
}

function validateTokenQuotaOverrides(
  client: Pick<PublicApiClientProfile, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>,
  token: Pick<
    PublicApiClientToken,
    'rate_limit_per_minute_override' | 'daily_quota_override' | 'monthly_call_budget_override'
  >
) {
  if (
    token.rate_limit_per_minute_override !== null &&
    token.rate_limit_per_minute_override > client.rate_limit_per_minute
  ) {
    return 'O override por minuto não pode exceder a quota do cliente'
  }
  if (token.daily_quota_override !== null && token.daily_quota_override > client.daily_quota) {
    return 'O override diário não pode exceder a quota do cliente'
  }
  if (
    token.monthly_call_budget_override !== null &&
    token.monthly_call_budget_override > client.monthly_call_budget
  ) {
    return 'O override mensal não pode exceder o budget do cliente'
  }

  const effectiveQuota = createEffectiveQuotaConfig(client, token)
  if (effectiveQuota.monthly_call_budget < effectiveQuota.daily_quota) {
    return 'O budget mensal efetivo precisa ser maior ou igual à quota diária efetiva'
  }

  return null
}

export const PATCH = withPublicApiAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  if (!isPublicApiWriteEnabled()) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'Gestão de tokens da API pública está bloqueada em produção. Use preview/staging.',
      },
      403
    )
  }

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

  const parsed = publicApiClientTokenPatchSchema.safeParse(await request.json().catch(() => null))
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

  const { data: existingToken, error: existingTokenError } = await supabase
    .from('public_api_client_tokens')
    .select(PUBLIC_API_CLIENT_TOKEN_COLUMNS)
    .eq('id', tokenId)
    .eq('client_id', clientId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (existingTokenError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingTokenError.message }, 500)
  }
  if (!existingToken) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Token de API não encontrado' }, 404)
  }

  const nextTokenState = {
    ...(existingToken as PublicApiClientToken),
    rate_limit_per_minute_override:
      parsed.data.rate_limit_per_minute_override !== undefined
        ? parsed.data.rate_limit_per_minute_override
        : (existingToken as PublicApiClientToken).rate_limit_per_minute_override,
    daily_quota_override:
      parsed.data.daily_quota_override !== undefined
        ? parsed.data.daily_quota_override
        : (existingToken as PublicApiClientToken).daily_quota_override,
    monthly_call_budget_override:
      parsed.data.monthly_call_budget_override !== undefined
        ? parsed.data.monthly_call_budget_override
        : (existingToken as PublicApiClientToken).monthly_call_budget_override,
  }

  const overrideError = validateTokenQuotaOverrides(
    client as Pick<PublicApiClientProfile, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>,
    nextTokenState
  )
  if (overrideError) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: overrideError }, 400)
  }

  const updates: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.exposure !== undefined) updates.exposure = parsed.data.exposure
  if (parsed.data.rate_limit_per_minute_override !== undefined) {
    updates.rate_limit_per_minute_override = parsed.data.rate_limit_per_minute_override
  }
  if (parsed.data.daily_quota_override !== undefined) {
    updates.daily_quota_override = parsed.data.daily_quota_override
  }
  if (parsed.data.monthly_call_budget_override !== undefined) {
    updates.monthly_call_budget_override = parsed.data.monthly_call_budget_override
  }
  if (parsed.data.expires_at !== undefined) updates.expires_at = parsed.data.expires_at || null
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes || null

  const { data, error } = await supabase
    .from('public_api_client_tokens')
    .update(updates)
    .eq('id', tokenId)
    .eq('client_id', clientId)
    .eq('org_id', orgId)
    .select(PUBLIC_API_CLIENT_TOKEN_COLUMNS)
    .maybeSingle()

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }
  if (!data) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Token de API não encontrado' }, 404)
  }

  return ok(request, {
    item: {
      ...(data as PublicApiClientToken),
      effective_quota: createEffectiveQuotaConfig(
        client as Pick<PublicApiClientProfile, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>,
        data as PublicApiClientToken
      ),
      quota_source: resolveTokenQuotaSource(data as PublicApiClientToken),
    } satisfies PublicApiClientToken,
    writeEnabled: true,
    runtimeStage: getPublicApiRuntimeStage(),
  })
})
