import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'

export async function POST(request: Request) {
  try {
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

    return ok(request, { accepted: true }, undefined, 202)
  } catch {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: 'Falha ao processar evento de monitoramento' }, 500)
  }
}
