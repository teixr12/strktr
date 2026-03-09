import { featureFlags } from '@/lib/feature-flags'
import { isFinanceDepthV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'

export function isFinanceDepthEnabled(): boolean {
  return featureFlags.financeDepthV1
}

export function isFinanceDepthEnabledForCurrentOrg(orgId: string | null | undefined): boolean {
  return isFinanceDepthV1EnabledForOrg(orgId)
}
