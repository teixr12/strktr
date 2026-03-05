export interface ObraLogisticsEstimateRequest {
  originLat?: number
  originLng?: number
  useOrgHq?: boolean
  originOverride?: {
    cep?: string | null
    logradouro?: string | null
    numero?: string | null
    complemento?: string | null
    bairro?: string | null
    cidade?: string | null
    estado?: string | null
    formatted_address?: string | null
    lat?: number | null
    lng?: number | null
  } | null
  consumptionKmPerLiter: number
  fuelPricePerLiter: number
  tollCost?: number
}

export interface ObraLogisticsLocationRef {
  lat: number
  lng: number
  formatted_address?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  source?: 'org_hq' | 'override' | 'obra'
}

export interface ObraLogisticsEstimatePayload {
  obra: {
    id: string
    nome: string
  }
  provider: 'openrouteservice' | 'osrm'
  origin: ObraLogisticsLocationRef
  destination: ObraLogisticsLocationRef
  route: {
    distanceKm: number
    durationMin: number
  }
  costs: {
    fuelLiters: number
    fuelCost: number
    tollCost: number
    totalCost: number
  }
  generatedAt: string
}
