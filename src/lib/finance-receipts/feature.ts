import { featureFlags } from '@/lib/feature-flags'
import { isFinanceReceiptAiEnabledForOrg, isFinanceReceiptsEnabledForOrg } from '@/server/feature-flags/wave2-canary'

export function isFinanceReceiptsEnabled(): boolean {
  return featureFlags.financeReceiptsV1
}

export function isFinanceReceiptAiEnabled(): boolean {
  return featureFlags.financeReceiptsV1 && featureFlags.financeReceiptAiV1
}

export function isFinanceReceiptsEnabledForCurrentOrg(orgId: string | null | undefined): boolean {
  return isFinanceReceiptsEnabledForOrg(orgId)
}

export function isFinanceReceiptAiEnabledForCurrentOrg(orgId: string | null | undefined): boolean {
  return isFinanceReceiptAiEnabledForOrg(orgId)
}
