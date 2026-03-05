import type { AddressFields, ObraLocationInput, ObraLocationSource } from '@/shared/types/obra-location'

const CACHE_TTL_MS = 1000 * 60 * 60 * 6
const addressCache = new Map<string, { expiresAt: number; value: ResolvedAddressLocation }>()

export class AddressResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AddressResolutionError'
  }
}

export interface ResolvedAddressLocation extends AddressFields {
  lat: number
  lng: number
  source: ObraLocationSource
}

type ViaCepResponse = {
  cep?: string
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

type NominatimSearchResponse = Array<{
  lat?: string
  lon?: string
  display_name?: string
  address?: {
    road?: string
    house_number?: string
    suburb?: string
    city?: string
    town?: string
    village?: string
    state?: string
    postcode?: string
  }
}>

function cachedGet(key: string) {
  const cached = addressCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    addressCache.delete(key)
    return null
  }
  return cached.value
}

function cachedSet(key: string, value: ResolvedAddressLocation) {
  addressCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value })
}

export function sanitizeCep(value: string | null | undefined): string | null {
  const digits = (value || '').replace(/\D/g, '')
  if (digits.length !== 8) return null
  return digits
}

function formatCep(value: string | null | undefined): string | null {
  const digits = sanitizeCep(value)
  if (!digits) return null
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function cleanText(value: string | null | undefined): string | null {
  const normalized = (value || '').trim()
  return normalized.length > 0 ? normalized : null
}

function buildAddressLabel(address: Partial<AddressFields>) {
  const left = [address.logradouro, address.numero].map(cleanText).filter(Boolean).join(', ')
  const middle = [address.bairro, address.cidade, address.estado].map(cleanText).filter(Boolean).join(' · ')
  const right = formatCep(address.cep)
  return [left, middle, right].filter(Boolean).join(' · ') || cleanText(address.formatted_address) || null
}

async function fetchViaCep(cep: string): Promise<Partial<AddressFields>> {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new AddressResolutionError(`viacep_status_${response.status}`)
  }
  const json = (await response.json()) as ViaCepResponse
  if (json.erro) {
    throw new AddressResolutionError('cep_nao_encontrado')
  }
  return {
    cep: formatCep(json.cep || cep),
    logradouro: cleanText(json.logradouro),
    complemento: cleanText(json.complemento),
    bairro: cleanText(json.bairro),
    cidade: cleanText(json.localidade),
    estado: cleanText(json.uf),
  }
}

async function geocodeAddress(address: Partial<AddressFields>) {
  const query = [
    [address.logradouro, address.numero].map(cleanText).filter(Boolean).join(', '),
    cleanText(address.bairro),
    cleanText(address.cidade),
    cleanText(address.estado),
    formatCep(address.cep),
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ')

  if (!query) {
    throw new AddressResolutionError('endereco_insuficiente')
  }

  const cacheKey = query.toLowerCase()
  const cached = cachedGet(cacheKey)
  if (cached) return cached

  const endpoint = new URL('https://nominatim.openstreetmap.org/search')
  endpoint.searchParams.set('format', 'jsonv2')
  endpoint.searchParams.set('limit', '1')
  endpoint.searchParams.set('countrycodes', 'br')
  endpoint.searchParams.set('addressdetails', '1')
  endpoint.searchParams.set('q', query)

  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'User-Agent': 'STRKTR CRM/1.0',
    },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new AddressResolutionError(`nominatim_status_${response.status}`)
  }

  const json = (await response.json()) as NominatimSearchResponse
  const match = json[0]
  const lat = Number(match?.lat)
  const lng = Number(match?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new AddressResolutionError('endereco_nao_localizado')
  }

  const value: ResolvedAddressLocation = {
    cep: formatCep(address.cep || match?.address?.postcode),
    logradouro: cleanText(address.logradouro || match?.address?.road),
    numero: cleanText(address.numero || match?.address?.house_number),
    complemento: cleanText(address.complemento),
    bairro: cleanText(address.bairro || match?.address?.suburb),
    cidade: cleanText(address.cidade || match?.address?.city || match?.address?.town || match?.address?.village),
    estado: cleanText(address.estado || match?.address?.state),
    formatted_address: cleanText(match?.display_name) || buildAddressLabel(address),
    lat,
    lng,
    source: 'geocoded',
  }
  cachedSet(cacheKey, value)
  return value
}

function hasAddressContent(input: Partial<AddressFields>) {
  return Boolean(
    sanitizeCep(input.cep) ||
      cleanText(input.logradouro) ||
      cleanText(input.bairro) ||
      cleanText(input.cidade) ||
      cleanText(input.estado) ||
      cleanText(input.formatted_address)
  )
}

export async function resolveAddressLocation(input: ObraLocationInput): Promise<ResolvedAddressLocation> {
  const baseAddress: Partial<AddressFields> = {
    cep: formatCep(input.cep),
    logradouro: cleanText(input.logradouro),
    numero: cleanText(input.numero),
    complemento: cleanText(input.complemento),
    bairro: cleanText(input.bairro),
    cidade: cleanText(input.cidade),
    estado: cleanText(input.estado),
    formatted_address: cleanText(input.formatted_address),
  }

  const lat = typeof input.lat === 'number' && Number.isFinite(input.lat) ? input.lat : null
  const lng = typeof input.lng === 'number' && Number.isFinite(input.lng) ? input.lng : null

  if (!hasAddressContent(baseAddress)) {
    if (lat === null || lng === null) {
      throw new AddressResolutionError('Defina um CEP/endereço válido ou informe latitude/longitude.')
    }
    return {
      cep: baseAddress.cep || null,
      logradouro: baseAddress.logradouro || null,
      numero: baseAddress.numero || null,
      complemento: baseAddress.complemento || null,
      bairro: baseAddress.bairro || null,
      cidade: baseAddress.cidade || null,
      estado: baseAddress.estado || null,
      formatted_address: baseAddress.formatted_address || buildAddressLabel(baseAddress),
      lat,
      lng,
      source: input.source || 'manual',
    }
  }

  let enrichedAddress = { ...baseAddress }
  if (sanitizeCep(baseAddress.cep)) {
    const viaCep = await fetchViaCep(sanitizeCep(baseAddress.cep) as string)
    enrichedAddress = {
      ...viaCep,
      ...enrichedAddress,
      cep: formatCep(baseAddress.cep || viaCep.cep),
      complemento: enrichedAddress.complemento || viaCep.complemento || null,
    }
  }

  if (cleanText(enrichedAddress.formatted_address) && !cleanText(enrichedAddress.logradouro)) {
    enrichedAddress.logradouro = cleanText(enrichedAddress.formatted_address)
  }

  const resolved = await geocodeAddress(enrichedAddress)
  return {
    ...resolved,
    numero: cleanText(enrichedAddress.numero) || resolved.numero,
    complemento: cleanText(enrichedAddress.complemento) || resolved.complemento,
    formatted_address: buildAddressLabel({ ...resolved, ...enrichedAddress }) || resolved.formatted_address,
    source: input.source === 'imported' ? 'imported' : 'geocoded',
  }
}

export function formatAddressSummary(address: Partial<AddressFields>) {
  return buildAddressLabel(address)
}
