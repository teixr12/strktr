export type SupplierRiskThresholdEvent = {
  type: 'supplier.risk.threshold_reached'
  org_id: string
  supplier_id: string
  overdue_count: number
}

type SupplierRiskThresholdInput = {
  org_id: string
  supplier_id: string
  overdue_count: number
}

export function buildSupplierRiskThresholdEvent(
  input: SupplierRiskThresholdInput
): SupplierRiskThresholdEvent {
  return {
    type: 'supplier.risk.threshold_reached',
    org_id: input.org_id,
    supplier_id: input.supplier_id,
    overdue_count: input.overdue_count,
  }
}
