import { featureFlags } from '@/lib/feature-flags'
import { isEmailTriageV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'

export function isEmailTriageEnabled(): boolean {
  return featureFlags.emailTriageV1
}

export function isEmailTriageEnabledForCurrentOrg(orgId: string | null | undefined): boolean {
  return isEmailTriageV1EnabledForOrg(orgId)
}
