import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { emitProductEvent, type ProductEventType } from '@/lib/telemetry'
import {
  ANALYTICS_EVENT_TYPES,
  type AnalyticsEventType,
} from '@/shared/types/analytics'

const ALLOWED_EVENTS: AnalyticsEventType[] = [...ANALYTICS_EVENT_TYPES]

export async function POST(request: Request) {
  const { user, supabase, error, requestId, orgId } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(
      request,
      { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' },
      401
    )
  }

  const body = await request.json().catch(() => null)
  const eventType = body?.eventType as AnalyticsEventType | undefined
  if (!eventType || !ALLOWED_EVENTS.includes(eventType)) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: 'eventType inválido para analytics',
      },
      400
    )
  }

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
      eventType: eventType as ProductEventType,
    entityType: body.entityType || 'unknown',
    entityId: body.entityId || crypto.randomUUID(),
    payload: body.payload || {},
  }).catch((err) => {
    log('error', 'analytics.track.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/analytics/events',
      error: err instanceof Error ? err.message : 'unknown',
    })
  })

  return ok(request, { tracked: true }, undefined, 202)
}
