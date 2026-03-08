import { featureFlags } from '@/lib/feature-flags'

export function isBillingEnabled() {
  return featureFlags.billingV1
}

export type BillingRuntimeStage = 'development' | 'preview' | 'production' | 'unknown'

export function getBillingRuntimeStage(): BillingRuntimeStage {
  const vercelEnv = process.env.VERCEL_ENV?.trim()
  if (vercelEnv === 'production') return 'production'
  if (vercelEnv === 'preview') return 'preview'
  if (vercelEnv === 'development') return 'development'
  if (process.env.NODE_ENV !== 'production') return 'development'
  return 'unknown'
}

export function isBillingWriteEnabled() {
  const override = process.env.BILLING_V1_WRITE_ENABLED?.trim()
  const stage = getBillingRuntimeStage()

  if (override === 'false') return false
  if (override === 'true') return stage !== 'production'

  return stage === 'development' || stage === 'preview'
}
