import { z } from 'zod'
import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { fetchObraByOrg } from '@/server/repositories/obras/execution-repository'
import { fetchOrgHqLocationByOrg } from '@/server/repositories/config/org-hq-repository'
import { isWave2FeatureEnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { fetchObraLocationByOrg } from '@/server/repositories/obras/location-repository'
import { AddressResolutionError, resolveAddressLocation } from '@/server/services/obras/address-service'
import {
  calculateLogisticsCosts,
  estimateRoute,
} from '@/server/services/obras/logistics-service'
import type {
  ObraLogisticsEstimatePayload,
  ObraLogisticsEstimateRequest,
} from '@/shared/types/obra-logistics'

const estimateSchema = z
  .object({
    originLat: z.number().min(-90).max(90).optional(),
    originLng: z.number().min(-180).max(180).optional(),
    useOrgHq: z.boolean().optional().default(true),
    originOverride: z
      .object({
        lat: z.number().min(-90).max(90).optional().nullable(),
        lng: z.number().min(-180).max(180).optional().nullable(),
        cep: z.string().trim().optional().nullable(),
        logradouro: z.string().trim().optional().nullable(),
        numero: z.string().trim().optional().nullable(),
        complemento: z.string().trim().optional().nullable(),
        bairro: z.string().trim().optional().nullable(),
        cidade: z.string().trim().optional().nullable(),
        estado: z.string().trim().optional().nullable(),
        formatted_address: z.string().trim().optional().nullable(),
      })
      .optional()
      .nullable(),
    consumptionKmPerLiter: z.number().positive().max(50),
    fuelPricePerLiter: z.number().positive().max(100),
    tollCost: z.number().min(0).max(5000).optional(),
  })
  .superRefine((value, ctx) => {
    const hasOriginLat = typeof value.originLat === 'number'
    const hasOriginLng = typeof value.originLng === 'number'
    if (hasOriginLat !== hasOriginLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['originLat'],
        message: 'Origem latitude/longitude devem ser informadas juntas.',
      })
    }
    const override = value.originOverride
    const hasOverrideLat = typeof override?.lat === 'number'
    const hasOverrideLng = typeof override?.lng === 'number'
    if (hasOverrideLat !== hasOverrideLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['originOverride', 'lat'],
        message: 'Origem manual latitude/longitude devem ser informadas juntas.',
      })
    }
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

  let origin:
    | {
        lat: number
        lng: number
        formatted_address?: string | null
        cidade?: string | null
        estado?: string | null
        cep?: string | null
        source: 'org_hq' | 'override'
      }
    | null = null

  if (payloadInput.originOverride) {
    try {
      const resolvedOrigin = await resolveAddressLocation({
        ...payloadInput.originOverride,
        source: 'manual',
      })
      origin = {
        lat: resolvedOrigin.lat,
        lng: resolvedOrigin.lng,
        formatted_address: resolvedOrigin.formatted_address,
        cidade: resolvedOrigin.cidade,
        estado: resolvedOrigin.estado,
        cep: resolvedOrigin.cep,
        source: 'override',
      }
    } catch (error) {
      const message =
        error instanceof AddressResolutionError
          ? error.message
          : 'Não foi possível resolver a origem manual.'
      return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message }, 400)
    }
  } else if (
    typeof payloadInput.originLat === 'number' &&
    typeof payloadInput.originLng === 'number'
  ) {
    origin = {
      lat: payloadInput.originLat,
      lng: payloadInput.originLng,
      source: 'override',
    }
  } else if (payloadInput.useOrgHq !== false) {
    const { data: hq, error: hqError } = await fetchOrgHqLocationByOrg(supabase, orgId)
    if (hqError) {
      return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: hqError.message }, 500)
    }
    if (hq) {
      origin = {
        lat: Number(hq.lat),
        lng: Number(hq.lng),
        formatted_address: hq.formatted_address || null,
        cidade: hq.cidade || null,
        estado: hq.estado || null,
        cep: hq.cep || null,
        source: 'org_hq',
      }
    }
  }

  if (!origin) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'Defina a sede da organização ou informe uma origem manual para simular logística.',
      },
      400
    )
  }

  try {
    const route = await estimateRoute({
      originLat: origin.lat,
      originLng: origin.lng,
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
      origin: {
        lat: origin.lat,
        lng: origin.lng,
        formatted_address: origin.formatted_address || null,
        cidade: origin.cidade || null,
        estado: origin.estado || null,
        cep: origin.cep || null,
        source: origin.source,
      },
      destination: {
        lat: Number(location.lat),
        lng: Number(location.lng),
        formatted_address: location.formatted_address || null,
        cidade: location.cidade || null,
        estado: location.estado || null,
        cep: location.cep || null,
        source: 'obra',
      },
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
