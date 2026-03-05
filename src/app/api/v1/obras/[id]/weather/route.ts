import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { fetchObraByOrg } from '@/server/repositories/obras/execution-repository'
import { isWave2FeatureEnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { fetchObraLocationByOrg } from '@/server/repositories/obras/location-repository'
import { fetchOpenMeteoForecast } from '@/server/services/obras/weather-service'
import type { ObraWeatherPayload } from '@/shared/types/obra-weather'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }
  if (!orgId) {
    return fail(
      request,
      { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' },
      403
    )
  }
  if (!isWave2FeatureEnabledForOrg('weather', orgId)) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Endpoint não disponível' }, 404)
  }

  const { id } = await params
  const { data: obra } = await fetchObraByOrg(supabase, id, orgId)
  if (!obra) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const { data: location, error: locationError } = await fetchObraLocationByOrg(supabase, id, orgId)
  if (locationError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: locationError.message }, 500)
  }

  if (!location) {
    const payload: ObraWeatherPayload = {
      obra: { id: obra.id, nome: obra.nome },
      location: null,
      provider: 'open-meteo',
      days: [],
      forecastDays: 0,
      generatedAt: new Date().toISOString(),
      unavailableReason: 'Defina a localização da obra para consultar previsão climática.',
    }
    return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_OBRA_WEATHER_V1' })
  }

  const searchParams = new URL(request.url).searchParams
  const rawDays = Number(searchParams.get('days') || '7')
  const forecastDays = Number.isFinite(rawDays) ? Math.max(3, Math.min(7, rawDays)) : 7

  try {
    const forecast = await fetchOpenMeteoForecast({
      lat: Number(location.lat),
      lng: Number(location.lng),
      forecastDays,
    })
    const payload: ObraWeatherPayload = {
      obra: { id: obra.id, nome: obra.nome },
      location: {
        lat: Number(location.lat),
        lng: Number(location.lng),
        formatted_address: location.formatted_address || null,
        cidade: location.cidade || null,
        estado: location.estado || null,
        cep: location.cep || null,
      },
      provider: 'open-meteo',
      days: forecast.days,
      forecastDays: forecast.days.length,
      generatedAt: new Date().toISOString(),
    }
    return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_OBRA_WEATHER_V1' })
  } catch (providerError) {
    const payload: ObraWeatherPayload = {
      obra: { id: obra.id, nome: obra.nome },
      location: {
        lat: Number(location.lat),
        lng: Number(location.lng),
        formatted_address: location.formatted_address || null,
        cidade: location.cidade || null,
        estado: location.estado || null,
        cep: location.cep || null,
      },
      provider: 'open-meteo',
      days: [],
      forecastDays: 0,
      generatedAt: new Date().toISOString(),
      unavailableReason:
        providerError instanceof Error
          ? 'Provider de clima indisponível no momento.'
          : 'Falha ao consultar provider de clima.',
    }
    return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_OBRA_WEATHER_V1' })
  }
}
