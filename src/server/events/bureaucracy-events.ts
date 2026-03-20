import type { BureaucracyRecord } from '@/shared/types/bureaucracy'

export type BureaucracyItemChangedEvent = {
  type: 'bureaucracy.item.changed'
  org_id: string
  item_id: string
  supplier_id: string | null
  previous_supplier_id: string | null
  status: BureaucracyRecord['status']
  proxima_checagem_em: string | null
  updated_at: string
}

type BureaucracyItemChangedInput = Pick<
  BureaucracyRecord,
  'id' | 'org_id' | 'supplier_id' | 'status' | 'proxima_checagem_em' | 'updated_at'
>

type BureaucracyItemChangedOverrides = {
  supplier_id?: string | null
  previous_supplier_id?: string | null
  status?: BureaucracyRecord['status']
  proxima_checagem_em?: string | null
  updated_at?: string
}

export function buildBureaucracyItemChangedEvent(
  item: BureaucracyItemChangedInput,
  overrides: BureaucracyItemChangedOverrides = {}
): BureaucracyItemChangedEvent {
  return {
    type: 'bureaucracy.item.changed',
    org_id: item.org_id,
    item_id: item.id,
    supplier_id: overrides.supplier_id !== undefined ? overrides.supplier_id : item.supplier_id,
    previous_supplier_id:
      overrides.previous_supplier_id !== undefined ? overrides.previous_supplier_id : null,
    status: overrides.status !== undefined ? overrides.status : item.status,
    proxima_checagem_em:
      overrides.proxima_checagem_em !== undefined ? overrides.proxima_checagem_em : item.proxima_checagem_em,
    updated_at: overrides.updated_at !== undefined ? overrides.updated_at : item.updated_at,
  }
}
