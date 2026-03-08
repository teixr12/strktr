import { featureFlags } from '@/lib/feature-flags'

export function isPublicApiEnabled() {
  return featureFlags.publicApiV1
}

export type PublicApiRuntimeStage = 'development' | 'preview' | 'production' | 'unknown'

export function getPublicApiRuntimeStage(): PublicApiRuntimeStage {
  const vercelEnv = process.env.VERCEL_ENV?.trim()
  if (vercelEnv === 'production') return 'production'
  if (vercelEnv === 'preview') return 'preview'
  if (vercelEnv === 'development') return 'development'
  if (process.env.NODE_ENV !== 'production') return 'development'
  return 'unknown'
}

export function isPublicApiWriteEnabled() {
  const override = process.env.PUBLIC_API_V1_WRITE_ENABLED?.trim()
  const stage = getPublicApiRuntimeStage()

  if (override === 'false') return false
  if (override === 'true') return stage !== 'production'

  return stage === 'development' || stage === 'preview'
}
