import { featureFlags } from '@/lib/feature-flags'
import { isBureaucracyV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'

export function isBureaucracyEnabled(): boolean {
  return featureFlags.bureaucracyV1
}

export function isBureaucracyEnabledForCurrentOrg(orgId: string | null | undefined): boolean {
  return isBureaucracyV1EnabledForOrg(orgId)
}
