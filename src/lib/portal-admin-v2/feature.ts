import { featureFlags } from '@/lib/feature-flags'

export function isPortalAdminV2Enabled() {
  return featureFlags.portalAdminV2
}
