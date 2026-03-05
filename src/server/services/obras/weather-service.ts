import type { ExecutionSeverity } from '@/shared/types/execution'
import type { ObraWeatherDay } from '@/shared/types/obra-weather'

type OpenMeteoResponse = {
  daily?: {
    time?: string[]
    weather_code?: number[]
    weathercode?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    precipitation_probability_max?: number[]
    wind_speed_10m_max?: number[]
    windspeed_10m_max?: number[]
  }
}

function weatherDescription(code: number | null): string {
  if (code === null) return 'Sem dados'
  if (code === 0) return 'Céu limpo'
  if ([1, 2, 3].includes(code)) return 'Parcialmente nublado'
  if ([45, 48].includes(code)) return 'Neblina'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Garoa'
  if ([61, 63, 65, 66, 67].includes(code)) return 'Chuva'
  if ([71, 73, 75, 77].includes(code)) return 'Neve'
  if ([80, 81, 82].includes(code)) return 'Pancadas de chuva'
  if ([95, 96, 99].includes(code)) return 'Tempestade'
  return 'Condição variável'
}

function evaluateSeverity(params: {
  tempMax: number | null
  precipProbMax: number | null
  windSpeedMax: number | null
  weatherCode: number | null
}): ExecutionSeverity {
  const { tempMax, precipProbMax, windSpeedMax, weatherCode } = params
  const stormLike = weatherCode !== null && [95, 96, 99].includes(weatherCode)
  if (
    stormLike ||
    (precipProbMax !== null && precipProbMax >= 70) ||
    (windSpeedMax !== null && windSpeedMax >= 50) ||
    (tempMax !== null && tempMax >= 36)
  ) {
    return 'high'
  }
  if (
    (precipProbMax !== null && precipProbMax >= 40) ||
    (windSpeedMax !== null && windSpeedMax >= 35) ||
    (tempMax !== null && tempMax >= 32)
  ) {
    return 'medium'
  }
  return 'low'
}

export async function fetchOpenMeteoForecast(params: {
  lat: number
  lng: number
  forecastDays?: number
}) {
  const { lat, lng, forecastDays = 7 } = params
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)
  try {
    const endpoint = new URL('https://api.open-meteo.com/v1/forecast')
    endpoint.searchParams.set('latitude', lat.toString())
    endpoint.searchParams.set('longitude', lng.toString())
    endpoint.searchParams.set('timezone', 'auto')
    endpoint.searchParams.set('forecast_days', Math.max(3, Math.min(7, forecastDays)).toString())
    endpoint.searchParams.set(
      'daily',
      [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'wind_speed_10m_max',
      ].join(',')
    )

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`open_meteo_status_${response.status}`)
    }
    const json = (await response.json()) as OpenMeteoResponse
    const daily = json.daily
    const dates = daily?.time || []
    const weatherCodes = daily?.weather_code || daily?.weathercode || []
    const maxTemps = daily?.temperature_2m_max || []
    const minTemps = daily?.temperature_2m_min || []
    const precip = daily?.precipitation_probability_max || []
    const wind = daily?.wind_speed_10m_max || daily?.windspeed_10m_max || []

    const days: ObraWeatherDay[] = dates.map((date, idx) => {
      const weatherCode = Number.isFinite(weatherCodes[idx]) ? weatherCodes[idx] : null
      const tempMax = Number.isFinite(maxTemps[idx]) ? maxTemps[idx] : null
      const tempMin = Number.isFinite(minTemps[idx]) ? minTemps[idx] : null
      const precipProbMax = Number.isFinite(precip[idx]) ? precip[idx] : null
      const windSpeedMax = Number.isFinite(wind[idx]) ? wind[idx] : null
      return {
        date,
        weatherCode,
        description: weatherDescription(weatherCode),
        tempMax,
        tempMin,
        precipProbMax,
        windSpeedMax,
        severity: evaluateSeverity({ tempMax, precipProbMax, windSpeedMax, weatherCode }),
      }
    })

    return { provider: 'open-meteo' as const, days }
  } finally {
    clearTimeout(timeout)
  }
}

