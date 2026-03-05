import { z } from 'zod'
import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { fetchObraByOrg } from '@/server/repositories/obras/execution-repository'
import {
  fetchObraLocationByOrg,
  upsertObraLocationByOrg,
} from '@/server/repositories/obras/location-repository'
import type { ObraLocationPayload } from '@/shared/types/obra-location'

const updateObraLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  source: z.enum(['manual', 'geocoded', 'imported']).default('manual'),
})

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

  const { id } = await params
  const { data: obra } = await fetchObraByOrg(supabase, id, orgId)
  if (!obra) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const { data, error: dbError } = await fetchObraLocationByOrg(supabase, id, orgId)
  if (dbError) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  const payload: ObraLocationPayload = {
    obra: { id: obra.id, nome: obra.nome },
    hasLocation: Boolean(data),
    location: data
      ? {
          obra_id: data.obra_id,
          lat: Number(data.lat),
          lng: Number(data.lng),
          source: data.source,
          updated_at: data.updated_at,
        }
      : null,
  }

  return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_OBRA_MAP_V1' })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
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

  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const parsed = updateObraLocationSchema.safeParse(await request.json().catch(() => null))
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

  const { id } = await params
  const { data: obra } = await fetchObraByOrg(supabase, id, orgId)
  if (!obra) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Obra não encontrada' }, 404)
  }

  const { data, error: dbError } = await upsertObraLocationByOrg(supabase, {
    orgId,
    obraId: id,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    source: parsed.data.source,
    userId: user.id,
  })

  if (dbError || !data) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: dbError?.message || 'Falha ao salvar localização' },
      500
    )
  }

  const payload: ObraLocationPayload = {
    obra: { id: obra.id, nome: obra.nome },
    hasLocation: true,
    location: {
      obra_id: data.obra_id,
      lat: Number(data.lat),
      lng: Number(data.lng),
      source: data.source,
      updated_at: data.updated_at,
    },
  }

  return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_OBRA_MAP_V1' })
}

