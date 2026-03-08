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
  | 'portalAdminV2'
  | 'obraIntelligenceV1'
  | 'financeDepthV1'
  | 'supplierManagementV1'
  | 'bureaucracyV1'
  | 'emailTriageV1'
  | 'billingV1'
  | 'referralV1'
  | 'publicApiV1'
  | 'integrationsHubV1'
  | 'superAdminV1'
  | 'agentReadyV1'
  | 'bigDataV1'
  | 'openBankingV1'

type RolloutSource =
  | 'wave2'
  | 'addressHq'
  | 'financeReceipts'
  | 'financeReceiptAi'
  | 'cronogramaUxV2'
  | 'docsWorkspace'
  | 'portalAdminV2'
  | 'obraIntelligenceV1'
  | 'financeDepthV1'
  | 'supplierManagementV1'
  | 'bureaucracyV1'
  | 'emailTriageV1'
  | 'billingV1'
  | 'referralV1'
  | 'publicApiV1'
  | 'integrationsHubV1'
  | 'superAdminV1'
  | 'agentReadyV1'
  | 'bigDataV1'
  | 'openBankingV1'

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

function createCanaryEnv(prefix: string, source: RolloutSource): CanaryEnvConfig {
  return {
    allowlistEnv: `FF_${prefix}_CANARY_ORGS`,
    percentEnv: `FF_${prefix}_CANARY_PERCENT`,
    source,
  }
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
  portalAdminV2: process.env.NEXT_PUBLIC_FF_PORTAL_ADMIN_V2,
  obraIntelligenceV1: process.env.NEXT_PUBLIC_FF_OBRA_INTELLIGENCE_V1,
  financeDepthV1: process.env.NEXT_PUBLIC_FF_FINANCE_DEPTH_V1,
  supplierManagementV1: process.env.NEXT_PUBLIC_FF_SUPPLIER_MANAGEMENT_V1,
  bureaucracyV1: process.env.NEXT_PUBLIC_FF_BUREAUCRACY_V1,
  emailTriageV1: process.env.NEXT_PUBLIC_FF_EMAIL_TRIAGE_V1,
  billingV1: process.env.NEXT_PUBLIC_FF_BILLING_V1,
  referralV1: process.env.NEXT_PUBLIC_FF_REFERRAL_V1,
  publicApiV1: process.env.NEXT_PUBLIC_FF_PUBLIC_API_V1,
  integrationsHubV1: process.env.NEXT_PUBLIC_FF_INTEGRATIONS_HUB_V1,
  superAdminV1: process.env.NEXT_PUBLIC_FF_SUPER_ADMIN_V1,
  agentReadyV1: process.env.NEXT_PUBLIC_FF_AGENT_READY_V1,
  bigDataV1: process.env.NEXT_PUBLIC_FF_BIG_DATA_V1,
  openBankingV1: process.env.NEXT_PUBLIC_FF_OPEN_BANKING_V1,
}

const DEFAULT_WAVE2_CANARY_ENV = createCanaryEnv('OBRA_WAVE2', 'wave2')
const ADDRESS_HQ_CANARY_ENV = createCanaryEnv('OBRA_ADDRESS_HQ', 'addressHq')
const FINANCE_RECEIPTS_CANARY_ENV = createCanaryEnv('FINANCE_RECEIPTS', 'financeReceipts')
const FINANCE_RECEIPT_AI_CANARY_ENV = createCanaryEnv('FINANCE_RECEIPT_AI', 'financeReceiptAi')
const CRONOGRAMA_UX_V2_CANARY_ENV = createCanaryEnv('CRONOGRAMA_UX_V2', 'cronogramaUxV2')
const DOCS_WORKSPACE_CANARY_ENV = createCanaryEnv('DOCS_WORKSPACE', 'docsWorkspace')
const PORTAL_ADMIN_V2_CANARY_ENV = createCanaryEnv('PORTAL_ADMIN_V2', 'portalAdminV2')
const OBRA_INTELLIGENCE_V1_CANARY_ENV = createCanaryEnv('OBRA_INTELLIGENCE_V1', 'obraIntelligenceV1')
const FINANCE_DEPTH_V1_CANARY_ENV = createCanaryEnv('FINANCE_DEPTH_V1', 'financeDepthV1')
const SUPPLIER_MANAGEMENT_V1_CANARY_ENV = createCanaryEnv(
  'SUPPLIER_MANAGEMENT_V1',
  'supplierManagementV1'
)
const BUREAUCRACY_V1_CANARY_ENV = createCanaryEnv('BUREAUCRACY_V1', 'bureaucracyV1')
const EMAIL_TRIAGE_V1_CANARY_ENV = createCanaryEnv('EMAIL_TRIAGE_V1', 'emailTriageV1')
const BILLING_V1_CANARY_ENV = createCanaryEnv('BILLING_V1', 'billingV1')
const REFERRAL_V1_CANARY_ENV = createCanaryEnv('REFERRAL_V1', 'referralV1')
const PUBLIC_API_V1_CANARY_ENV = createCanaryEnv('PUBLIC_API_V1', 'publicApiV1')
const INTEGRATIONS_HUB_V1_CANARY_ENV = createCanaryEnv('INTEGRATIONS_HUB_V1', 'integrationsHubV1')
const SUPER_ADMIN_V1_CANARY_ENV = createCanaryEnv('SUPER_ADMIN_V1', 'superAdminV1')
const AGENT_READY_V1_CANARY_ENV = createCanaryEnv('AGENT_READY_V1', 'agentReadyV1')
const BIG_DATA_V1_CANARY_ENV = createCanaryEnv('BIG_DATA_V1', 'bigDataV1')
const OPEN_BANKING_V1_CANARY_ENV = createCanaryEnv('OPEN_BANKING_V1', 'openBankingV1')

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
  portalAdminV2: PORTAL_ADMIN_V2_CANARY_ENV,
  obraIntelligenceV1: OBRA_INTELLIGENCE_V1_CANARY_ENV,
  financeDepthV1: FINANCE_DEPTH_V1_CANARY_ENV,
  supplierManagementV1: SUPPLIER_MANAGEMENT_V1_CANARY_ENV,
  bureaucracyV1: BUREAUCRACY_V1_CANARY_ENV,
  emailTriageV1: EMAIL_TRIAGE_V1_CANARY_ENV,
  billingV1: BILLING_V1_CANARY_ENV,
  referralV1: REFERRAL_V1_CANARY_ENV,
  publicApiV1: PUBLIC_API_V1_CANARY_ENV,
  integrationsHubV1: INTEGRATIONS_HUB_V1_CANARY_ENV,
  superAdminV1: SUPER_ADMIN_V1_CANARY_ENV,
  agentReadyV1: AGENT_READY_V1_CANARY_ENV,
  bigDataV1: BIG_DATA_V1_CANARY_ENV,
  openBankingV1: OPEN_BANKING_V1_CANARY_ENV,
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

export function getObraIntelligenceV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('obraIntelligenceV1')
}

export function getPortalAdminV2CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('portalAdminV2')
}

export function getFinanceDepthV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('financeDepthV1')
}

export function getSupplierManagementV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('supplierManagementV1')
}

export function getBureaucracyV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('bureaucracyV1')
}

export function getEmailTriageV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('emailTriageV1')
}

export function getBillingV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('billingV1')
}

export function getIntegrationsHubV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('integrationsHubV1')
}

export function getPublicApiV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('publicApiV1')
}

export function getReferralV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('referralV1')
}

export function getAgentReadyV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('agentReadyV1')
}

export function getSuperAdminV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('superAdminV1')
}

export function getBigDataV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('bigDataV1')
}

export function getOpenBankingV1CanarySnapshot(): OrgCanarySnapshot {
  return getFeatureCanarySnapshot('openBankingV1')
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

export function isPortalAdminV2EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('portalAdminV2', orgId)
}

export function isObraIntelligenceEnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('obraIntelligenceV1', orgId)
}

export function isFinanceDepthV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('financeDepthV1', orgId)
}

export function isSupplierManagementV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('supplierManagementV1', orgId)
}

export function isBureaucracyV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('bureaucracyV1', orgId)
}

export function isEmailTriageV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('emailTriageV1', orgId)
}

export function isBillingV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('billingV1', orgId)
}

export function isIntegrationsHubV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('integrationsHubV1', orgId)
}

export function isPublicApiV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('publicApiV1', orgId)
}

export function isReferralV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('referralV1', orgId)
}

export function isAgentReadyV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('agentReadyV1', orgId)
}

export function isSuperAdminV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('superAdminV1', orgId)
}

export function isBigDataV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('bigDataV1', orgId)
}

export function isOpenBankingV1EnabledForOrg(orgId: string | null | undefined): boolean {
  return isFeatureEnabledForOrg('openBankingV1', orgId)
}
