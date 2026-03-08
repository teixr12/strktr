import { featureFlags } from '@/lib/feature-flags'

export function isSuperAdminEnabled() {
  return featureFlags.superAdminV1
}
