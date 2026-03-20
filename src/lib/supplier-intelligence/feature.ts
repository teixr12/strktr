import { isFlagDisabledByDefault } from '@/lib/feature-flags'

export function isSupplierIntelligenceEnabled(): boolean {
  return isFlagDisabledByDefault(process.env.FF_SUPPLIER_INTELLIGENCE_V1)
}
