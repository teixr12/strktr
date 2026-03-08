import { featureFlags } from '@/lib/feature-flags'
import { isObraIntelligenceEnabledForOrg } from '@/server/feature-flags/wave2-canary'

export function isObraIntelligenceEnabled(): boolean {
  return featureFlags.obraIntelligenceV1
}

export function isObraIntelligenceEnabledForCurrentOrg(orgId: string | null | undefined): boolean {
  return isObraIntelligenceEnabledForOrg(orgId)
}
