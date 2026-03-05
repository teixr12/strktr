import { featureFlags } from '@/lib/feature-flags'

export function isFinanceReceiptsEnabled(): boolean {
  return featureFlags.financeReceiptsV1
}

export function isFinanceReceiptAiEnabled(): boolean {
  return featureFlags.financeReceiptsV1 && featureFlags.financeReceiptAiV1
}
