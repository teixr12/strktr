import { z } from 'zod'
import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { fetchOrgHqLocationByOrg, upsertOrgHqLocationByOrg } from '@/server/repositories/config/org-hq-repository'
import { isWave2FeatureEnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { AddressResolutionError, resolveAddressLocation } from '@/server/services/obras/address-service'
import type { OrgHqLocationPayload } from '@/shared/types/org-hq-location'

const updateOrgHqLocationSchema = z
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
    source: z.enum(['manual', 'geocoded', 'imported']).default('manual'),
  })
  .superRefine((value, ctx) => {
    const hasLat = typeof value.lat === 'number'
    const hasLng = typeof value.lng === 'number'
    const hasAddress = Boolean(
      value.cep ||
        value.logradouro ||
        value.bairro ||
        value.cidade ||
        value.estado ||
        value.formatted_address
    )
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lat'],
        message: 'Latitude e longitude devem ser informadas juntas.',
      })
    }
    if (!hasAddress && !(hasLat && hasLng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cep'],
        message: 'Informe um CEP/endereço ou latitude/longitude.',
      })
    }
  })

function mapPayload(
  org: { id: string; nome: string },
  data: {
    org_id: string
    lat: number | string
    lng: number | string
    source: 'manual' | 'geocoded' | 'imported'
    updated_at: string
    cep?: string | null
    logradouro?: string | null
    numero?: string | null
    complemento?: string | null
    bairro?: string | null
    cidade?: string | null
    estado?: string | null
    formatted_address?: string | null
  } | null
): OrgHqLocationPayload {
  return {
    organizacao: org,
    hasLocation: Boolean(data),
    location: data
      ? {
          org_id: data.org_id,
          lat: Number(data.lat),
          lng: Number(data.lng),
          source: data.source,
          updated_at: data.updated_at,
          cep: data.cep || null,
          logradouro: data.logradouro || null,
          numero: data.numero || null,
          complemento: data.complemento || null,
          bairro: data.bairro || null,
          cidade: data.cidade || null,
          estado: data.estado || null,
          formatted_address: data.formatted_address || null,
        }
      : null,
  }
}

export async function GET(request: Request) {
  const { user, supabase, error, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  if (!isWave2FeatureEnabledForOrg('hqRouting', orgId)) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Endpoint não disponível' }, 404)
  }

  const { data: org, error: orgError } = await supabase
    .from('organizacoes')
    .select('id, nome')
    .eq('id', orgId)
    .maybeSingle()
  if (orgError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: orgError.message }, 500)
  }
  if (!org) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Organização não encontrada' }, 404)
  }

  const { data, error: dbError } = await fetchOrgHqLocationByOrg(supabase, orgId)
  if (dbError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  return ok(request, mapPayload(org, data), { flag: 'NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1' })
}

export async function PATCH(request: Request) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  if (!isWave2FeatureEnabledForOrg('hqRouting', orgId)) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Endpoint não disponível' }, 404)
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_team')
  if (permissionError) return permissionError

  const parsed = updateOrgHqLocationSchema.safeParse(await request.json().catch(() => null))
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

  const { data: org, error: orgError } = await supabase
    .from('organizacoes')
    .select('id, nome')
    .eq('id', orgId)
    .maybeSingle()
  if (orgError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: orgError.message }, 500)
  }
  if (!org) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Organização não encontrada' }, 404)
  }

  let resolvedLocation
  try {
    resolvedLocation = await resolveAddressLocation(parsed.data)
  } catch (error) {
    const message =
      error instanceof AddressResolutionError
        ? error.message
        : 'Não foi possível resolver a localização da sede.'
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message }, 400)
  }

  const { data, error: dbError } = await upsertOrgHqLocationByOrg(supabase, {
    orgId,
    lat: resolvedLocation.lat,
    lng: resolvedLocation.lng,
    source: resolvedLocation.source,
    userId: user.id,
    address: resolvedLocation,
  })
  if (dbError || !data) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError?.message || 'Falha ao salvar sede' },
      500
    )
  }

  return ok(request, mapPayload(org, data), { flag: 'NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1' })
}
