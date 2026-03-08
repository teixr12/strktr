import { featureFlags } from '@/lib/feature-flags'

export function isReferralEnabled() {
  return featureFlags.referralV1
}
