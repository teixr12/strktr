type RouteResult = {
  provider: 'openrouteservice' | 'osrm'
  distanceKm: number
  durationMin: number
}

async function fetchFromOpenRouteService(params: {
  originLat: number
  originLng: number
  destinationLat: number
  destinationLng: number
  apiKey: string
}): Promise<RouteResult> {
  const { originLat, originLng, destinationLat, destinationLng, apiKey } = params
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4500)
  try {
    const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: apiKey,
      },
      body: JSON.stringify({
        coordinates: [
          [originLng, originLat],
          [destinationLng, destinationLat],
        ],
      }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`openrouteservice_status_${response.status}`)
    const json = await response.json() as {
      features?: Array<{ properties?: { summary?: { distance?: number; duration?: number } } }>
    }
    const summary = json.features?.[0]?.properties?.summary
    const distanceM = summary?.distance
    const durationS = summary?.duration
    if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) {
      throw new Error('openrouteservice_invalid_summary')
    }
    const resolvedDistanceM = Number(distanceM)
    const resolvedDurationS = Number(durationS)
    return {
      provider: 'openrouteservice',
      distanceKm: resolvedDistanceM / 1000,
      durationMin: resolvedDurationS / 60,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchFromOsrm(params: {
  originLat: number
  originLng: number
  destinationLat: number
  destinationLng: number
}): Promise<RouteResult> {
  const { originLat, originLng, destinationLat, destinationLng } = params
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4500)
  try {
    const endpoint = new URL(
      `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destinationLng},${destinationLat}`
    )
    endpoint.searchParams.set('overview', 'false')
    endpoint.searchParams.set('steps', 'false')
    endpoint.searchParams.set('alternatives', 'false')
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`osrm_status_${response.status}`)
    const json = await response.json() as {
      code?: string
      routes?: Array<{ distance?: number; duration?: number }>
    }
    if (json.code !== 'Ok') throw new Error(`osrm_code_${json.code || 'unknown'}`)
    const route = json.routes?.[0]
    if (!Number.isFinite(route?.distance) || !Number.isFinite(route?.duration)) {
      throw new Error('osrm_invalid_summary')
    }
    return {
      provider: 'osrm',
      distanceKm: (route?.distance || 0) / 1000,
      durationMin: (route?.duration || 0) / 60,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function estimateRoute(params: {
  originLat: number
  originLng: number
  destinationLat: number
  destinationLng: number
}) {
  const orsApiKey = (process.env.OPENROUTESERVICE_API_KEY || '').trim()
  if (orsApiKey.length > 0) {
    try {
      return await fetchFromOpenRouteService({
        ...params,
        apiKey: orsApiKey,
      })
    } catch {
      // fallback to OSRM below
    }
  }
  return fetchFromOsrm(params)
}

export function calculateLogisticsCosts(params: {
  distanceKm: number
  consumptionKmPerLiter: number
  fuelPricePerLiter: number
  tollCost?: number
}) {
  const fuelLiters = params.distanceKm / params.consumptionKmPerLiter
  const fuelCost = fuelLiters * params.fuelPricePerLiter
  const tollCost = params.tollCost || 0
  const totalCost = fuelCost + tollCost
  return {
    fuelLiters,
    fuelCost,
    tollCost,
    totalCost,
  }
}
