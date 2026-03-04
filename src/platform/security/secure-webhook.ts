import { legacyFail } from '@/lib/api/legacy-compat-response'

type SecureWebhookOptions = {
  token?: string | null
  tokenHeader?: string
  allowInsecureOverrideEnv?: string
  requireTimestamp?: boolean
  timestampHeader?: string
  timestampToleranceSeconds?: number
}

export function enforceSecureWebhook(request: Request, options: SecureWebhookOptions) {
  const isProduction = process.env.NODE_ENV === 'production'
  const token = (options.token || '').trim()
  const tokenHeader = options.tokenHeader || 'x-strktr-webhook-token'
  const allowInsecure =
    (options.allowInsecureOverrideEnv || 'WEBHOOK_DISPATCH_ALLOW_UNSECURED') in process.env &&
    process.env[options.allowInsecureOverrideEnv || 'WEBHOOK_DISPATCH_ALLOW_UNSECURED'] === 'true'

  const receivedToken = request.headers.get(tokenHeader)
  if (token && receivedToken !== token) {
    return legacyFail(request, 'Não autorizado', 403, 'UNAUTHORIZED')
  }

  if (isProduction && !token && !allowInsecure) {
    return legacyFail(request, 'Webhook token obrigatório em produção', 403, 'UNAUTHORIZED')
  }

  if (options.requireTimestamp) {
    const timestampHeader = options.timestampHeader || 'x-strktr-webhook-ts'
    const rawTimestamp = request.headers.get(timestampHeader)
    if (!rawTimestamp) {
      return legacyFail(request, 'Timestamp obrigatório', 400, 'VALIDATION_ERROR')
    }
    const timestamp = Number(rawTimestamp)
    if (!Number.isFinite(timestamp)) {
      return legacyFail(request, 'Timestamp inválido', 400, 'VALIDATION_ERROR')
    }
    const toleranceSeconds = options.timestampToleranceSeconds ?? 300
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
      return legacyFail(request, 'Timestamp fora da janela permitida', 401, 'REPLAY_BLOCKED')
    }
  }

  return null
}
