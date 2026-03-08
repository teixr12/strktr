import { featureFlags } from '@/lib/feature-flags'

export function isOpenBankingEnabled() {
  return featureFlags.openBankingV1
}
