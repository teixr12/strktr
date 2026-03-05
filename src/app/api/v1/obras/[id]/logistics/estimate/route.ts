import { z } from 'zod'
import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { fetchObraByOrg } from '@/server/repositories/obras/execution-repository'
import { isWave2FeatureEnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { fetchObraLocationByOrg } from '@/server/repositories/obras/location-repository'
import {
  calculateLogisticsCosts,
  estimateRoute,
} from '@/server/services/obras/logistics-service'
import type {
  ObraLogisticsEstimatePayload,
  ObraLogisticsEstimateRequest,
} from '@/shared/types/obra-logistics'

const estimateSchema = z.object({
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  consumptionKmPerLiter: z.number().positive().max(50),
  fuelPricePerLiter: z.number().positive().max(100),
  tollCost: z.number().min(0).max(5000).optional(),
})

function round(value: number, precision = 2) {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!isWave2FeatureEnabledForOrg('logistics', orgId)) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Endpoint não disponível' }, 404)
  }

  const parsed = estimateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message || 'Payload inválido',
      },
      400
    )
  }

  const payloadInput = parsed.data as ObraLogisticsEstimateRequest
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
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Defina a localização da obra antes de estimar logística.',
      },
      400
    )
  }

  try {
    const route = await estimateRoute({
      originLat: payloadInput.originLat,
      originLng: payloadInput.originLng,
      destinationLat: Number(location.lat),
      destinationLng: Number(location.lng),
    })

    const costs = calculateLogisticsCosts({
      distanceKm: route.distanceKm,
      consumptionKmPerLiter: payloadInput.consumptionKmPerLiter,
      fuelPricePerLiter: payloadInput.fuelPricePerLiter,
      tollCost: payloadInput.tollCost || 0,
    })

    const payload: ObraLogisticsEstimatePayload = {
      obra: { id: obra.id, nome: obra.nome },
      provider: route.provider,
      origin: { lat: payloadInput.originLat, lng: payloadInput.originLng },
      destination: { lat: Number(location.lat), lng: Number(location.lng) },
      route: {
        distanceKm: round(route.distanceKm),
        durationMin: round(route.durationMin),
      },
      costs: {
        fuelLiters: round(costs.fuelLiters, 3),
        fuelCost: round(costs.fuelCost),
        tollCost: round(costs.tollCost),
        totalCost: round(costs.totalCost),
      },
      generatedAt: new Date().toISOString(),
    }

    return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1' })
  } catch (providerError) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.DB_ERROR,
        message: 'provider_unavailable',
        details: providerError instanceof Error ? providerError.message : 'route_estimate_failed',
      },
      503
    )
  }
}
