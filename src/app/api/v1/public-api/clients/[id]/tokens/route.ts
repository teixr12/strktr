import { createHash, randomBytes } from 'crypto'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import type { AuthContext } from '@/lib/api/with-auth'
import { withPublicApiAuth } from '@/lib/public-api/api'
import { getPublicApiRuntimeStage, isPublicApiWriteEnabled } from '@/lib/public-api/feature'
import { createEffectiveQuotaConfig, evaluateQuotaStatus, resolveTokenQuotaSource } from '@/server/services/public-api/client-quota'
import { createEmptyUsageSummary, getPublicApiTokenUsageSummaries } from '@/server/services/public-api/client-usage'
import { publicApiClientTokenCreateSchema } from '@/shared/schemas/public-api'
import type {
  PublicApiClientProfile,
  PublicApiClientToken,
  PublicApiClientTokenCreatePayload,
  PublicApiClientTokensPayload,
} from '@/shared/types/public-api'

const PUBLIC_API_CLIENT_TOKEN_COLUMNS =
  'id, org_id, client_id, label, status, exposure, token_prefix, token_last_four, rate_limit_per_minute_override, daily_quota_override, monthly_call_budget_override, expires_at, last_used_at, notes, created_at, updated_at'

function resolveClientId(request: Request): string | null {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  const clientsIndex = segments.findIndex((segment) => segment === 'clients')
  const id = clientsIndex >= 0 ? segments[clientsIndex + 1] : null
  return id?.trim() || null
}

async function ensureClientBelongsToOrg(
  supabase: AuthContext['supabase'],
  orgId: string,
  clientId: string
) {
  const { data, error } = await supabase
    .from('public_api_clients')
    .select('id, rate_limit_per_minute, daily_quota, monthly_call_budget')
    .eq('id', clientId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) return { error }
  return { client: (data as Pick<PublicApiClientProfile, 'id' | 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'> | null) || null }
}

function generateTokenSecret() {
  const secret = randomBytes(24).toString('base64url')
  const token = `strkpk_test_${secret}`
  return {
    token,
    tokenPrefix: 'strkpk_test',
    tokenLastFour: token.slice(-4),
    tokenHash: createHash('sha256').update(token).digest('hex'),
  }
}

function validateTokenQuotaOverrides(
  client: Pick<PublicApiClientProfile, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>,
  overrides: {
    rate_limit_per_minute_override?: number | null
    daily_quota_override?: number | null
    monthly_call_budget_override?: number | null
  }
) {
  if (
    overrides.rate_limit_per_minute_override !== undefined &&
    overrides.rate_limit_per_minute_override !== null &&
    overrides.rate_limit_per_minute_override > client.rate_limit_per_minute
  ) {
    return 'O override por minuto não pode exceder a quota do cliente'
  }

  if (
    overrides.daily_quota_override !== undefined &&
    overrides.daily_quota_override !== null &&
    overrides.daily_quota_override > client.daily_quota
  ) {
    return 'O override diário não pode exceder a quota do cliente'
  }

  if (
    overrides.monthly_call_budget_override !== undefined &&
    overrides.monthly_call_budget_override !== null &&
    overrides.monthly_call_budget_override > client.monthly_call_budget
  ) {
    return 'O override mensal não pode exceder o budget do cliente'
  }

  const effectiveQuota = createEffectiveQuotaConfig(client, {
    rate_limit_per_minute_override: overrides.rate_limit_per_minute_override ?? null,
    daily_quota_override: overrides.daily_quota_override ?? null,
    monthly_call_budget_override: overrides.monthly_call_budget_override ?? null,
  })

  if (effectiveQuota.monthly_call_budget < effectiveQuota.daily_quota) {
    return 'O budget mensal efetivo precisa ser maior ou igual à quota diária efetiva'
  }

  return null
}

function attachQuotaPreview(
  token: PublicApiClientToken,
  client: Pick<PublicApiClientProfile, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>
): PublicApiClientToken {
  const effectiveQuota = createEffectiveQuotaConfig(client, token)
  const usage = createEmptyUsageSummary(
    effectiveQuota.rate_limit_per_minute,
    effectiveQuota.daily_quota,
    effectiveQuota.monthly_call_budget
  )

  return {
    ...token,
    effective_quota: effectiveQuota,
    quota_source: resolveTokenQuotaSource(token),
    usage,
    quota_status: evaluateQuotaStatus(usage, effectiveQuota),
  }
}

export const GET = withPublicApiAuth('can_manage_team', async (request, { supabase, orgId }) => {
  const clientId = resolveClientId(request)
  if (!clientId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'id inválido' }, 400)
  }

  const clientCheck = await ensureClientBelongsToOrg(supabase, orgId, clientId)
  if (clientCheck.error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: clientCheck.error.message }, 500)
  }
  if (!clientCheck.client) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Cliente de API não encontrado' }, 404)
  }

  const { data, error } = await supabase
    .from('public_api_client_tokens')
    .select(PUBLIC_API_CLIENT_TOKEN_COLUMNS)
    .eq('org_id', orgId)
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const tokens = ((data || []) as PublicApiClientToken[])
  const usageSummaries = await getPublicApiTokenUsageSummaries(supabase, orgId, clientCheck.client, tokens)
  if (!usageSummaries.ok) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: usageSummaries.error.message }, 500)
  }

  return ok(request, {
    tokens: tokens.map((token) => ({
      ...token,
      effective_quota: usageSummaries.data[token.id]?.effectiveQuota,
      quota_source: usageSummaries.data[token.id]?.quotaSource,
      usage: usageSummaries.data[token.id]?.summary,
      quota_status: usageSummaries.data[token.id]?.quota,
    })),
    writeEnabled: isPublicApiWriteEnabled(),
    runtimeStage: getPublicApiRuntimeStage(),
  } satisfies PublicApiClientTokensPayload)
})

export const POST = withPublicApiAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
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

  const clientId = resolveClientId(request)
  if (!clientId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'id inválido' }, 400)
  }

  const parsed = publicApiClientTokenCreateSchema.safeParse(await request.json().catch(() => null))
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

  const clientCheck = await ensureClientBelongsToOrg(supabase, orgId, clientId)
  if (clientCheck.error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: clientCheck.error.message }, 500)
  }
  if (!clientCheck.client) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Cliente de API não encontrado' }, 404)
  }

  const overrideError = validateTokenQuotaOverrides(clientCheck.client, {
    rate_limit_per_minute_override: parsed.data.rate_limit_per_minute_override,
    daily_quota_override: parsed.data.daily_quota_override,
    monthly_call_budget_override: parsed.data.monthly_call_budget_override,
  })
  if (overrideError) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: overrideError }, 400)
  }

  const generated = generateTokenSecret()
  const { data, error } = await supabase
    .from('public_api_client_tokens')
    .insert({
      org_id: orgId,
      client_id: clientId,
      label: parsed.data.label,
      status: 'active',
      exposure: parsed.data.exposure,
      token_prefix: generated.tokenPrefix,
      token_last_four: generated.tokenLastFour,
      token_hash: generated.tokenHash,
      rate_limit_per_minute_override: parsed.data.rate_limit_per_minute_override ?? null,
      daily_quota_override: parsed.data.daily_quota_override ?? null,
      monthly_call_budget_override: parsed.data.monthly_call_budget_override ?? null,
      expires_at: parsed.data.expires_at || null,
      notes: parsed.data.notes || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(PUBLIC_API_CLIENT_TOKEN_COLUMNS)
    .single()

  if (error || !data) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao criar token interno' }, 500)
  }

  return ok(request, {
    item: attachQuotaPreview(data as PublicApiClientToken, clientCheck.client),
    plainToken: generated.token,
    writeEnabled: true,
    runtimeStage: getPublicApiRuntimeStage(),
  } satisfies PublicApiClientTokenCreatePayload)
})
