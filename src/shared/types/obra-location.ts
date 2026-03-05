export type ObraLocationSource = 'manual' | 'geocoded' | 'imported'

export interface ObraLocationPoint {
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

