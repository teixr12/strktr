import { featureFlags } from '@/lib/feature-flags'
import { isSupplierManagementV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'

export function isSupplierManagementEnabled(): boolean {
  return featureFlags.supplierManagementV1
}

export function isSupplierManagementEnabledForCurrentOrg(orgId: string | null | undefined): boolean {
  return isSupplierManagementV1EnabledForOrg(orgId)
}
