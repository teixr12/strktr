import type {
  PublicApiClientProfile,
  PublicApiClientQuotaEvaluation,
  PublicApiQuotaConfig,
  PublicApiClientUsageEvent,
  PublicApiClientUsageSummary,
  PublicApiClientToken,
  PublicApiTokenQuotaSource,
} from '@/shared/types/public-api'

function nowUtc() {
  return new Date()
}

function startOfUtcMinute(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes()
    )
  )
}

export function createQuotaAwareUsageSummary(
  rows: PublicApiClientUsageEvent[],
  quota: Pick<PublicApiQuotaConfig, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>
): PublicApiClientUsageSummary {
  const now = nowUtc()
  const minuteStart = startOfUtcMinute(now).toISOString()
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const currentMinuteCalls = rows
    .filter((row) => row.created_at >= minuteStart)
    .reduce((sum, row) => sum + row.call_count, 0)

  const dailyCalls = rows
    .filter((row) => row.created_at >= dayStart)
    .reduce((sum, row) => sum + row.call_count, 0)

  const monthlyCalls = rows
    .filter((row) => row.created_at >= monthStart)
    .reduce((sum, row) => sum + row.call_count, 0)

  return {
    current_minute_calls: currentMinuteCalls,
    daily_calls: dailyCalls,
    monthly_calls: monthlyCalls,
    rate_limit_remaining: Math.max(0, quota.rate_limit_per_minute - currentMinuteCalls),
    daily_quota_remaining: Math.max(0, quota.daily_quota - dailyCalls),
    monthly_budget_remaining: Math.max(0, quota.monthly_call_budget - monthlyCalls),
    last_activity_at: rows[0]?.created_at || null,
  }
}

export function projectQuotaAwareUsageSummary(
  usage: PublicApiClientUsageSummary,
  quota: Pick<PublicApiQuotaConfig, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>,
  callCount: number
): PublicApiClientUsageSummary {
  const safeCallCount = Math.max(0, callCount)

  return {
    current_minute_calls: usage.current_minute_calls + safeCallCount,
    daily_calls: usage.daily_calls + safeCallCount,
    monthly_calls: usage.monthly_calls + safeCallCount,
    rate_limit_remaining: Math.max(0, quota.rate_limit_per_minute - (usage.current_minute_calls + safeCallCount)),
    daily_quota_remaining: Math.max(0, quota.daily_quota - (usage.daily_calls + safeCallCount)),
    monthly_budget_remaining: Math.max(0, quota.monthly_call_budget - (usage.monthly_calls + safeCallCount)),
    last_activity_at: new Date().toISOString(),
  }
}

export function createEffectiveQuotaConfig(
  client: Pick<PublicApiClientProfile, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>,
  token?: Pick<
    PublicApiClientToken,
    'rate_limit_per_minute_override' | 'daily_quota_override' | 'monthly_call_budget_override'
  >
): PublicApiQuotaConfig {
  return {
    rate_limit_per_minute: token?.rate_limit_per_minute_override ?? client.rate_limit_per_minute,
    daily_quota: token?.daily_quota_override ?? client.daily_quota,
    monthly_call_budget: token?.monthly_call_budget_override ?? client.monthly_call_budget,
  }
}

export function resolveTokenQuotaSource(
  token?: Pick<
    PublicApiClientToken,
    'rate_limit_per_minute_override' | 'daily_quota_override' | 'monthly_call_budget_override'
  >
): PublicApiTokenQuotaSource {
  const overrideCount = [
    token?.rate_limit_per_minute_override,
    token?.daily_quota_override,
    token?.monthly_call_budget_override,
  ].filter((value) => value !== null && value !== undefined).length

  if (overrideCount === 0) return 'client_default'
  if (overrideCount === 3) return 'token_override_full'
  return 'token_override_partial'
}

export function evaluateQuotaStatus(
  usage: PublicApiClientUsageSummary,
  quota: Pick<PublicApiQuotaConfig, 'rate_limit_per_minute' | 'daily_quota' | 'monthly_call_budget'>
): PublicApiClientQuotaEvaluation {
  const reasons: string[] = []

  if (usage.current_minute_calls >= quota.rate_limit_per_minute) {
    reasons.push('rate_limit_per_minute_reached')
    return { status: 'blocked_rate_limit', would_block: true, reasons }
  }

  if (usage.daily_calls >= quota.daily_quota) {
    reasons.push('daily_quota_reached')
    return { status: 'blocked_daily', would_block: true, reasons }
  }

  if (usage.monthly_calls >= quota.monthly_call_budget) {
    reasons.push('monthly_budget_reached')
    return { status: 'blocked_monthly', would_block: true, reasons }
  }

  const dailyRatio = quota.daily_quota > 0 ? usage.daily_calls / quota.daily_quota : 0
  const monthlyRatio = quota.monthly_call_budget > 0 ? usage.monthly_calls / quota.monthly_call_budget : 0
  const minuteRatio = quota.rate_limit_per_minute > 0 ? usage.current_minute_calls / quota.rate_limit_per_minute : 0

  if (dailyRatio >= 0.8) reasons.push('daily_quota_above_80_percent')
  if (monthlyRatio >= 0.8) reasons.push('monthly_budget_above_80_percent')
  if (minuteRatio >= 0.8) reasons.push('rate_limit_above_80_percent')

  if (reasons.length > 0) {
    return { status: 'warning', would_block: false, reasons }
  }

  return { status: 'healthy', would_block: false, reasons: [] }
}
