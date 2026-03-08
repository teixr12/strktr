import type { AuthContext } from '@/lib/api/with-auth'
import type {
  PublicApiClientProfile,
  PublicApiClientQuotaEvaluation,
  PublicApiClientUsageEvent,
  PublicApiClientUsagePayload,
  PublicApiClientUsageSummary,
  PublicApiClientToken,
  PublicApiClientTokenUsagePayload,
  PublicApiQuotaConfig,
  PublicApiTokenQuotaSource,
} from '@/shared/types/public-api'
import {
  createEffectiveQuotaConfig,
  createQuotaAwareUsageSummary,
  evaluateQuotaStatus,
  resolveTokenQuotaSource,
} from '@/server/services/public-api/client-quota'

type SupabaseClient = AuthContext['supabase']

const USAGE_EVENT_COLUMNS =
  'id, org_id, client_id, token_id, source, endpoint_family, outcome, call_count, created_at'

type UsageQuotaConfig = {
  rateLimitPerMinute: number
  dailyQuota: number
  monthlyBudget: number
}

type UsageQuotaByClient = Record<string, UsageQuotaConfig>
type UsageSummaryResult =
  | { ok: false; error: { message: string } }
  | { ok: true; data: Record<string, PublicApiClientUsageSummary> }
type TokenUsageSummaryResult =
  | { ok: false; error: { message: string } }
  | {
      ok: true
      data: Record<
        string,
        {
          summary: PublicApiClientUsageSummary
          quota: PublicApiClientQuotaEvaluation
          effectiveQuota: PublicApiQuotaConfig
          quotaSource: PublicApiTokenQuotaSource
        }
      >
    }

function nowUtc() {
  return new Date()
}

function lookbackStart(date: Date) {
  return new Date(date.getTime() - 90 * 24 * 60 * 60 * 1000)
}

export function createEmptyUsageSummary(
  rateLimitPerMinute: number,
  dailyQuota: number,
  monthlyBudget: number
): PublicApiClientUsageSummary {
  return {
    current_minute_calls: 0,
    daily_calls: 0,
    monthly_calls: 0,
    rate_limit_remaining: rateLimitPerMinute,
    daily_quota_remaining: dailyQuota,
    monthly_budget_remaining: monthlyBudget,
    last_activity_at: null,
  }
}

export async function getPublicApiUsageSummaries(
  supabase: SupabaseClient,
  orgId: string,
  clients: Array<Pick<PublicApiClientProfile, 'id' | 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>>
): Promise<UsageSummaryResult> {
  if (clients.length === 0) return { ok: true, data: {} }

  const quotasByClient = Object.fromEntries(
    clients.map((client) => [
      client.id,
      {
        rateLimitPerMinute: client.rate_limit_per_minute,
        dailyQuota: client.daily_quota,
        monthlyBudget: client.monthly_call_budget,
      },
    ])
  ) satisfies UsageQuotaByClient

  const { data, error } = await supabase
    .from('public_api_client_usage_events')
    .select(USAGE_EVENT_COLUMNS)
    .eq('org_id', orgId)
    .in(
      'client_id',
      clients.map((client) => client.id)
    )
    .gte('created_at', lookbackStart(nowUtc()).toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    return { ok: false, error: { message: error.message } }
  }

  const grouped = new Map<string, PublicApiClientUsageEvent[]>()
  for (const row of ((data || []) as PublicApiClientUsageEvent[])) {
    const current = grouped.get(row.client_id) || []
    current.push(row)
    grouped.set(row.client_id, current)
  }

  return {
    ok: true,
    data: Object.fromEntries(
      clients.map((client) => [
        client.id,
        createQuotaAwareUsageSummary(grouped.get(client.id) || [], {
          rate_limit_per_minute: quotasByClient[client.id].rateLimitPerMinute,
          daily_quota: quotasByClient[client.id].dailyQuota,
          monthly_call_budget: quotasByClient[client.id].monthlyBudget,
        }),
      ])
    ),
  }
}

export async function getPublicApiClientUsage(
  supabase: SupabaseClient,
  orgId: string,
  client: Pick<PublicApiClientProfile, 'id' | 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>
): Promise<{ error?: { message: string }; payload?: PublicApiClientUsagePayload }> {
  const { data, error } = await supabase
    .from('public_api_client_usage_events')
    .select(USAGE_EVENT_COLUMNS)
    .eq('org_id', orgId)
    .eq('client_id', client.id)
    .gte('created_at', lookbackStart(nowUtc()).toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    return { error: { message: error.message } }
  }

  const events = (data || []) as PublicApiClientUsageEvent[]
  const summary = createQuotaAwareUsageSummary(events, client)
  return {
    payload: {
      clientId: client.id,
      summary,
      quota: evaluateQuotaStatus(summary, client),
      events: events.slice(0, 50),
    },
  }
}

export async function getPublicApiTokenUsageSummaries(
  supabase: SupabaseClient,
  orgId: string,
  client: Pick<PublicApiClientProfile, 'id' | 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>,
  tokens: Array<
    Pick<
      PublicApiClientToken,
      'id' | 'rate_limit_per_minute_override' | 'daily_quota_override' | 'monthly_call_budget_override'
    >
  >
): Promise<TokenUsageSummaryResult> {
  if (tokens.length === 0) {
    return { ok: true, data: {} }
  }

  const { data, error } = await supabase
    .from('public_api_client_usage_events')
    .select(USAGE_EVENT_COLUMNS)
    .eq('org_id', orgId)
    .eq('client_id', client.id)
    .in(
      'token_id',
      tokens.map((token) => token.id)
    )
    .gte('created_at', lookbackStart(nowUtc()).toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    return { ok: false, error: { message: error.message } }
  }

  const grouped = new Map<string, PublicApiClientUsageEvent[]>()
  for (const row of ((data || []) as PublicApiClientUsageEvent[])) {
    if (!row.token_id) continue
    const current = grouped.get(row.token_id) || []
    current.push(row)
    grouped.set(row.token_id, current)
  }

  return {
    ok: true,
    data: Object.fromEntries(
      tokens.map((token) => {
        const effectiveQuota = createEffectiveQuotaConfig(client, token)
        const summary = createQuotaAwareUsageSummary(grouped.get(token.id) || [], effectiveQuota)
        return [
          token.id,
          {
            summary,
            quota: evaluateQuotaStatus(summary, effectiveQuota),
            effectiveQuota,
            quotaSource: resolveTokenQuotaSource(token),
          },
        ]
      })
    ),
  }
}

export async function getPublicApiClientTokenUsage(
  supabase: SupabaseClient,
  orgId: string,
  client: Pick<PublicApiClientProfile, 'id' | 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>,
  token: Pick<
    PublicApiClientToken,
    'id' | 'rate_limit_per_minute_override' | 'daily_quota_override' | 'monthly_call_budget_override'
  >
): Promise<{ error?: { message: string }; payload?: PublicApiClientTokenUsagePayload }> {
  const { data, error } = await supabase
    .from('public_api_client_usage_events')
    .select(USAGE_EVENT_COLUMNS)
    .eq('org_id', orgId)
    .eq('client_id', client.id)
    .eq('token_id', token.id)
    .gte('created_at', lookbackStart(nowUtc()).toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    return { error: { message: error.message } }
  }

  const events = (data || []) as PublicApiClientUsageEvent[]
  const effectiveQuota = createEffectiveQuotaConfig(client, token)
  const summary = createQuotaAwareUsageSummary(events, effectiveQuota)
  return {
    payload: {
      clientId: client.id,
      tokenId: token.id,
      effective_quota: effectiveQuota,
      quota_source: resolveTokenQuotaSource(token),
      summary,
      quota: evaluateQuotaStatus(summary, effectiveQuota),
      events: events.slice(0, 50),
    },
  }
}
