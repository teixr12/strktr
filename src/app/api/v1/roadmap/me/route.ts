import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { ensureRoadmapForUser } from '@/server/services/roadmap/roadmap-service'

export async function GET(request: Request) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }

  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const roadmapEnabled = process.env.NEXT_PUBLIC_FF_PERSONAL_ROADMAP === 'true'
  if (!roadmapEnabled) {
    return ok(
      request,
      {
        profileType: 'field',
        progress: { total: 0, pending: 0, completedToday: 0 },
        actions: [],
      },
      {
        flag: 'NEXT_PUBLIC_FF_PERSONAL_ROADMAP',
        enabled: false,
      }
    )
  }

  try {
    const payload = await ensureRoadmapForUser({
      supabase,
      orgId,
      userId: user.id,
      role,
    })

    return ok(request, payload, { flag: 'NEXT_PUBLIC_FF_PERSONAL_ROADMAP', enabled: true })
  } catch (roadmapError) {
    log('error', 'roadmap.me.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/roadmap/me',
      error: roadmapError instanceof Error ? roadmapError.message : 'unknown',
    })

    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: 'Falha ao carregar roadmap personalizado' },
      500
    )
  }
}
