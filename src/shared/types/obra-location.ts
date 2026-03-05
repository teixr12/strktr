export type ObraLocationSource = 'manual' | 'geocoded' | 'imported'

export interface AddressFields {
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  formatted_address: string | null
}

export interface ObraLocationPoint extends AddressFields {
  obra_id: string
  lat: number
  lng: number
  source: ObraLocationSource
  updated_at: string
}

export interface ObraLocationPayload {
  obra: {
    id: string
    nome: string
  }
  hasLocation: boolean
  location: ObraLocationPoint | null
}

export interface ObraLocationInput extends Partial<AddressFields> {
  lat?: number | null
  lng?: number | null
  source?: ObraLocationSource
}
