import type { AddressFields, ObraLocationSource } from '@/shared/types/obra-location'

export interface OrgHqLocation extends AddressFields {
  org_id: string
  lat: number
  lng: number
  source: ObraLocationSource
  updated_at: string
}

export interface OrgHqLocationPayload {
  organizacao: {
    id: string
    nome: string
  }
  hasLocation: boolean
  location: OrgHqLocation | null
}
