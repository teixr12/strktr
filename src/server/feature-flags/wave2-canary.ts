import { isFlagDisabledByDefault } from '@/lib/feature-flags'

export type Wave2FeatureKey = 'weather' | 'map' | 'logistics' | 'weatherAlerts'

type Wave2CanarySnapshot = {
  configured: boolean
  percent: number
  allowlistCount: number
}

const WAVE2_FEATURE_ENV: Record<Wave2FeatureKey, string | undefined> = {
  weather: process.env.NEXT_PUBLIC_FF_OBRA_WEATHER_V1,
  map: process.env.NEXT_PUBLIC_FF_OBRA_MAP_V1,
  logistics: process.env.NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1,
  weatherAlerts: process.env.NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1,
}

function parseOrgAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
}

function parseCanaryPercent(raw: string | undefined): number {
  const parsed = Number.parseInt((raw || '').trim(), 10)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(100, parsed))
}

function hashToBucket(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000
  }
  return hash % 100
}

function buildSnapshot(): Wave2CanarySnapshot {
  const allowlist = parseOrgAllowlist(process.env.FF_OBRA_WAVE2_CANARY_ORGS)
  const percent = parseCanaryPercent(process.env.FF_OBRA_WAVE2_CANARY_PERCENT)
  return {
    configured: allowlist.size > 0 || percent > 0,
    percent,
    allowlistCount: allowlist.size,
  }
}

function isOrgInWave2Canary(orgId: string): boolean {
  const allowlist = parseOrgAllowlist(process.env.FF_OBRA_WAVE2_CANARY_ORGS)
  if (allowlist.has(orgId)) return true

  const percent = parseCanaryPercent(process.env.FF_OBRA_WAVE2_CANARY_PERCENT)
  if (percent <= 0) return false
  return hashToBucket(orgId) < percent
}

export function getWave2CanarySnapshot(): Wave2CanarySnapshot {
  return buildSnapshot()
}

export function isWave2FeatureEnabledForOrg(
  feature: Wave2FeatureKey,
  orgId: string | null | undefined
): boolean {
  if (!isFlagDisabledByDefault(WAVE2_FEATURE_ENV[feature])) return false
  if (!orgId) return false

  const snapshot = buildSnapshot()
  if (!snapshot.configured) return true
  return isOrgInWave2Canary(orgId)
}

export function isWave2LocationEnabledForOrg(orgId: string | null | undefined): boolean {
  return (
    isWave2FeatureEnabledForOrg('map', orgId) ||
    isWave2FeatureEnabledForOrg('weather', orgId) ||
    isWave2FeatureEnabledForOrg('logistics', orgId) ||
    isWave2FeatureEnabledForOrg('weatherAlerts', orgId)
  )
}
