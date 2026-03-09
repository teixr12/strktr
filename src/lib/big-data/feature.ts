import { featureFlags } from '@/lib/feature-flags'

export function isBigDataEnabled() {
  return featureFlags.bigDataV1
}
