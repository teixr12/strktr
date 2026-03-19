import { isFlagDisabledByDefault } from '@/lib/feature-flags'

export type Wave2FeatureKey =
  | 'weather'
  | 'map'
  | 'logistics'
  | 'weatherAlerts'
  | 'addressV2'
  | 'hqRouting'

export type OrgRolloutFeatureKey =
  | Wave2FeatureKey
  | 'financeReceipts'
  | 'financeReceiptAi'
  | 'cronogramaUxV2'
  | 'docsWorkspace'
  | 'supplierManagementV1'

type RolloutSource =
  | 'wave2'
  | 'addressHq'
  | 'financeReceipts'
  | 'financeReceiptAi'
  | 'cronogramaUxV2'
  | 'docsWorkspace'
  | 'supplierManagementV1'

export type OrgCanarySnapshot = {
  configured: boolean
  percent: number
  allowlistCount: number
  source: RolloutSource
}

type CanaryEnvConfig = {
  allowlistEnv: string
  percentEnv: string
  source: RolloutSource
}

const FEATURE_FLAG_ENV: Record<OrgRolloutFeatureKey, string | undefined> = {
  weather: process.env.NEXT_PUBLIC_FF_OBRA_WEATHER_V1,
  map: process.env.NEXT_PUBLIC_FF_OBRA_MAP_V1,
  logistics: process.env.NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1,
  weatherAlerts: process.env.NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1,
  addressV2: process.env.NEXT_PUBLIC_FF_OBRA_ADDRESS_UX_V2,
  hqRouting: process.env.NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1,
  financeReceipts: process.env.NEXT_PUBLIC_FF_FINANCE_RECEIPTS_V1,
  financeReceiptAi: process.env.NEXT_PUBLIC_FF_FINANCE_RECEIPT_AI_V1,
  cronogramaUxV2: process.env.NEXT_PUBLIC_FF_CRONOGRAMA_UX_V2,
  docsWorkspace: process.env.NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1,
  supplierManagementV1: process.env.NEXT_PUBLIC_FF_SUPPLIER_MANAGEMENT_V1,
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

const FINANCE_RECEIPTS_CANARY_ENV: CanaryEnvConfig = {
  allowlistEnv: 'FF_FINANCE_RECEIPTS_CANARY_ORGS',
  percentEnv: 'FF_FINANCE_RECEIPTS_CANARY_PERCENT',
  source: 'financeReceipts',
}

const FINANCE_RECEIPT_AI_CANARY_ENV: CanaryEnvConfig = {
  allowlistEnv: 'FF_FINANCE_RECEIPT_AI_CANARY_ORGS',
  percentEnv: 'FF_FINANCE_RECEIPT_AI_CANARY_PERCENT',
  source: 'financeReceiptAi',
}

const CRONOGRAMA_UX_V2_CANARY_ENV: CanaryEnvConfig = {
  allowlistEnv: 'FF_CRONOGRAMA_UX_V2_CANARY_ORGS',
  percentEnv: 'FF_CRONOGRAMA_UX_V2_CANARY_PERCENT',
  source: 'cronogramaUxV2',
}

const DOCS_WORKSPACE_CANARY_ENV: CanaryEnvConfig = {
  allowlistEnv: 'FF_DOCS_WORKSPACE_CANARY_ORGS',
  percentEnv: 'FF_DOCS_WORKSPACE_CANARY_PERCENT',
  source: 'docsWorkspace',
}

const SUPPLIER_MANAGEMENT_V1_CANARY_ENV: CanaryEnvConfig = {
  allowlistEnv: 'FF_SUPPLIER_MANAGEMENT_V1_CANARY_ORGS',
  percentEnv: 'FF_SUPPLIER_MANAGEMENT_V1_CANARY_PERCENT',
  source: 'supplierManagementV1',
}

const FEATURE_CANARY_ENV: Record<OrgRolloutFeatureKey, CanaryEnvConfig> = {
  weather: DEFAULT_WAVE2_CANARY_ENV,
  map: DEFAULT_WAVE2_CANARY_ENV,
  logistics: DEFAULT_WAVE2_CANARY_ENV,
  weatherAlerts: DEFAULT_WAVE2_CANARY_ENV,
  addressV2: ADDRESS_HQ_CANARY_ENV,
  hqRouting: ADDRESS_HQ_CANARY_ENV,
  financeReceipts: FINANCE_RECEIPTS_CANARY_ENV,
  financeReceiptAi: FINANCE_RECEIPT_AI_CANARY_ENV,
  cronogramaUxV2: CRONOGRAMA_UX_V2_CANARY_ENV,
  docsWorkspace: DOCS_WORKSPACE_CANARY_ENV,
  supplierManagementV1: SUPPLIER_MANAGEMENT_V1_CANARY_ENV,
}

function normalizeEnv(value: string | undefined): string {
  return (value || '').trim()
}

function parseOrgAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    normalizeEnv(raw)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
}

function parseCanaryPercent(raw: string | undefined): number {
  const parsed = Number.parseInt(normalizeEnv(raw), 10)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.min(100, parsed))
}

function hasExplicitCanaryConfig(config: CanaryEnvConfig): boolean {
  return Boolean(normalizeEnv(process.env[config.allowlistEnv]) || normalizeEnv(process.env[config.percentEnv]))
}

function hashToBucket(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000
  }
  return hash % 100
}

function buildSnapshot(config: CanaryEnvConfig): OrgCanarySnapshot {
  const allowlist = parseOrgAllowlist(process.env[config.allowlistEnv])
  const percent = parseCanaryPercent(process.env[config.percentEnv])
  return {
    configured: hasExplicitCanaryConfig(config),
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

function resolveCanaryConfig(feature: OrgRolloutFeatureKey): CanaryEnvConfig {
  if (feature === 'addressV2' || feature === 'hqRouting') {
    const addressConfig = FEATURE_CANARY_ENV[feature]
    if (hasExplicitCanaryConfig(addressConfig)) return addressConfig
    return DEFAULT_WAVE2_CANARY_ENV
  }

  return FEATURE_CANARY_ENV[feature]
}

export function getFeatureCanarySnapshot(feature: OrgRolloutFeatureKey): OrgCanarySnapshot {
  return buildSnapshot(resolveCanaryConfig(feature))
}

export function isFeatureEnabledForOrg(
  feature: OrgRolloutFeatureKey,
  orgId: string | null | undefined
): boolean {
  if (!isFlagDisabledByDefault(FEATURE_FLAG_ENV[feature])) return false
  if (!orgId) return false

  const config = resolveCanaryConfig(feature)
  const snapshot = buildSnapshot(config)
  if (!snapshot.configured) return true
  return isOrgInCanary(orgId, config)
}

export function getWave2CanarySnapshot(): OrgCanarySnapshot {
  return buildSnapshot(DEFAULT_WAVE2_CANARY_ENV)
}

export function getAddressHqCanarySnapshot(): OrgCanarySnapshot {
  return buildSnapshot(resolveCanaryConfig('addressV2'))
}

export function getFinanceReceiptsCanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('financeReceipts')
}

export function getFinanceReceiptAiCanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('financeReceiptAi')
}

export function getCronogramaUxV2CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('cronogramaUxV2')
}

export function getDocsWorkspaceCanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('docsWorkspace')
}

export function getSupplierManagementV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('supplierManagementV1')
}

export function isWave2FeatureEnabledForOrg(
  feature: Wave2FeatureKey,
  orgId: string | null | undefined
): boolean {
  return isFeatureEnabledForOrg(feature, orgId)
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

export function isFinanceReceiptsEnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('financeReceipts', orgId)
}

export function isFinanceReceiptAiEnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('financeReceipts', orgId) && isFeatureEnabledForOrg('financeReceiptAi', orgId)
}

export function isCronogramaUxV2EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('cronogramaUxV2', orgId)
}

export function isDocsWorkspaceEnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('docsWorkspace', orgId)
}

export function isSupplierManagementV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('supplierManagementV1', orgId)
}
