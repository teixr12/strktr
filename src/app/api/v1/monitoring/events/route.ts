import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { enforceRateLimit } from '@/platform/security/rate-limit'

export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for') || ''
    const ip = forwardedFor.split(',')[0]?.trim() || 'anonymous'
    const rateLimit = enforceRateLimit(ip, {
      id: 'monitoring_events_ingest',
      windowMs: 60 * 1000,
      max: 120,
    })

    if (!rateLimit.allowed) {
      const response = fail(
        request,
        { code: API_ERROR_CODES.RATE_LIMITED, message: 'Muitas tentativas de envio de eventos de monitoramento' },
        429
      )
      for (const [key, value] of Object.entries(rateLimit.headers)) {
        response.headers.set(key, value)
      }
      return response
    }

    const body = await request.json()
    if (!body?.type || !body?.message) {
      return fail(
        request,
        { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Payload inválido: type e message são obrigatórios' },
        400
      )
    }

    log('error', 'client.error.captured', {
      requestId: request.headers.get('x-request-id') || crypto.randomUUID(),
      route: '/api/v1/monitoring/events',
      kind: body.type,
      message: body.message,
      stack: body.stack || null,
      path: body.path || null,
      context: body.context || {},
    })

    const response = ok(request, { accepted: true }, undefined, 202)
    for (const [key, value] of Object.entries(rateLimit.headers)) {
      response.headers.set(key, value)
    }
    return response
  } catch {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: 'Falha ao processar evento de monitoramento' }, 500)
  }
}
