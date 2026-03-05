export interface ObraLogisticsEstimateRequest {
  originLat: number
  originLng: number
  consumptionKmPerLiter: number
  fuelPricePerLiter: number
  tollCost?: number
}

export interface ObraLogisticsEstimatePayload {
  obra: {
    id: string
    nome: string
  }
  provider: 'openrouteservice' | 'osrm'
  origin: {
    lat: number
    lng: number
  }
  destination: {
    lat: number
    lng: number
  }
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

