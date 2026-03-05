import { isFlagDisabledByDefault } from '@/lib/feature-flags'

export type Wave2FeatureKey =
  | 'weather'
  | 'map'
  | 'logistics'
  | 'weatherAlerts'
  | 'addressV2'
  | 'hqRouting'

type Wave2CanarySnapshot = {
  configured: boolean
  percent: number
  allowlistCount: number
  source: 'wave2' | 'addressHq'
}

type CanaryEnvConfig = {
  allowlistEnv: string
  percentEnv: string
  source: Wave2CanarySnapshot['source']
}

const WAVE2_FEATURE_ENV: Record<Wave2FeatureKey, string | undefined> = {
  weather: process.env.NEXT_PUBLIC_FF_OBRA_WEATHER_V1,
  map: process.env.NEXT_PUBLIC_FF_OBRA_MAP_V1,
  logistics: process.env.NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1,
  weatherAlerts: process.env.NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1,
  addressV2: process.env.NEXT_PUBLIC_FF_OBRA_ADDRESS_UX_V2,
  hqRouting: process.env.NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1,
}

const DEFAULT_WAVE2_CANARY_ENV: CanaryEnvConfig = {
  allowlistEnv: 'FF_OBRA_WAVE2_CANARY_ORGS',
  percentEnv: 'FF_OBRA_WAVE2_CANARY_PERCENT',
  source: 'wave2',
}

const ADDRESS_HQ_CANARY_ENV: CanaryEnvConfig = {
  allowlistEnv: 'FF_OBRA_ADDRESS_HQ_CANARY_ORGS',
  percentEnv: 'FF_OBRA_ADDRESS_HQ_CANARY_PERCENT',
  source: 'addressHq',
}

const FEATURE_CANARY_ENV: Partial<Record<Wave2FeatureKey, CanaryEnvConfig>> = {
  addressV2: ADDRESS_HQ_CANARY_ENV,
  hqRouting: ADDRESS_HQ_CANARY_ENV,
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

function buildSnapshot(config: CanaryEnvConfig): Wave2CanarySnapshot {
  const allowlist = parseOrgAllowlist(process.env[config.allowlistEnv])
  const percent = parseCanaryPercent(process.env[config.percentEnv])
  return {
    configured: allowlist.size > 0 || percent > 0,
    percent,
    allowlistCount: allowlist.size,
    source: config.source,
  }
}

function isOrgInCanary(orgId: string, config: CanaryEnvConfig): boolean {
  const allowlist = parseOrgAllowlist(process.env[config.allowlistEnv])
  if (allowlist.has(orgId)) return true

  const percent = parseCanaryPercent(process.env[config.percentEnv])
  if (percent <= 0) return false
  return hashToBucket(orgId) < percent
}

export function getWave2CanarySnapshot(): Wave2CanarySnapshot {
  return buildSnapshot(DEFAULT_WAVE2_CANARY_ENV)
}

function resolveCanaryConfig(feature: Wave2FeatureKey): CanaryEnvConfig {
  const featureConfig = FEATURE_CANARY_ENV[feature]
  if (!featureConfig) return DEFAULT_WAVE2_CANARY_ENV

  const featureSnapshot = buildSnapshot(featureConfig)
  if (featureSnapshot.configured) return featureConfig
  return DEFAULT_WAVE2_CANARY_ENV
}

export function getAddressHqCanarySnapshot(): Wave2CanarySnapshot {
  return buildSnapshot(resolveCanaryConfig('addressV2'))
}

export function isWave2FeatureEnabledForOrg(
  feature: Wave2FeatureKey,
  orgId: string | null | undefined
): boolean {
  if (!isFlagDisabledByDefault(WAVE2_FEATURE_ENV[feature])) return false
  if (!orgId) return false

  const config = resolveCanaryConfig(feature)
  const snapshot = buildSnapshot(config)
  if (!snapshot.configured) return true
  return isOrgInCanary(orgId, config)
}

export function isWave2LocationEnabledForOrg(orgId: string | null | undefined): boolean {
  return (
    isWave2FeatureEnabledForOrg('map', orgId) ||
    isWave2FeatureEnabledForOrg('weather', orgId) ||
    isWave2FeatureEnabledForOrg('logistics', orgId) ||
    isWave2FeatureEnabledForOrg('weatherAlerts', orgId) ||
    isWave2FeatureEnabledForOrg('addressV2', orgId) ||
    isWave2FeatureEnabledForOrg('hqRouting', orgId)
  )
}
