import type { ExecutionSeverity } from '@/shared/types/execution'

export interface ObraWeatherDay {
  date: string
  weatherCode: number | null
  description: string
  tempMax: number | null
  tempMin: number | null
  precipProbMax: number | null
  windSpeedMax: number | null
  severity: ExecutionSeverity
}

export interface ObraWeatherPayload {
  obra: {
    id: string
    nome: string
  }
  location: {
    lat: number
    lng: number
  } | null
  provider: 'open-meteo'
  days: ObraWeatherDay[]
  forecastDays: number
  generatedAt: string
  unavailableReason?: string
}

