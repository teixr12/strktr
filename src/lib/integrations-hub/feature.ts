import { featureFlags } from '@/lib/feature-flags'

export function isIntegrationsHubEnabled() {
  return featureFlags.integrationsHubV1
}

export type IntegrationsHubRuntimeStage = 'development' | 'preview' | 'production' | 'unknown'

export function getIntegrationsHubRuntimeStage(): IntegrationsHubRuntimeStage {
  const vercelEnv = process.env.VERCEL_ENV?.trim()
  if (vercelEnv === 'production') return 'production'
  if (vercelEnv === 'preview') return 'preview'
  if (vercelEnv === 'development') return 'development'
  if (process.env.NODE_ENV !== 'production') return 'development'
  return 'unknown'
}

export function isIntegrationsHubWriteEnabled() {
  const override = process.env.INTEGRATIONS_HUB_V1_WRITE_ENABLED?.trim()
  const stage = getIntegrationsHubRuntimeStage()

  if (override === 'false') return false
  if (override === 'true') return stage !== 'production'

  return stage === 'development' || stage === 'preview'
}
