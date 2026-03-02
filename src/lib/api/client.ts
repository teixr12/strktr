import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/analytics/client'

type ApiErrorPayload = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

type ApiEnvelope<T, M = Record<string, unknown>> = {
  data: T
  meta?: M
  requestId?: string
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Disable automatic retry on 5xx/network errors (default: retries enabled for GET) */
  noRetry?: boolean
}

const MAX_RETRIES = 2
const BASE_DELAY_MS = 500

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504
}

function shouldRetry(method: string, status: number): boolean {
  // Only retry idempotent methods (GET, PUT, DELETE) or specific server errors
  if (method === 'POST' || method === 'PATCH') return false
  return isRetryable(status)
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestApi<T, M = Record<string, unknown>>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiEnvelope<T, M>> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new Error('Sessão inválida. Faça login novamente.')
  }

  const method = options.method ?? 'GET'
  const canRetry = !options.noRetry
  let lastError: Error | null = null
  let attempt = 0

  while (attempt <= (canRetry ? MAX_RETRIES : 0)) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 200
      await sleep(delay)
    }

    let response: Response
    const startedAt = performance.now()

    try {
      response = await fetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      })
    } catch (err) {
      // Network error (offline, DNS failure, etc.)
      lastError = err instanceof Error ? err : new Error('Erro de rede')
      if (canRetry && shouldRetry(method, 0) && attempt < MAX_RETRIES) {
        attempt++
        continue
      }
      throw lastError
    }

    const latencyMs = Math.round(performance.now() - startedAt)
    const latencyBucket = latencyMs >= 2000 ? '2s+' : latencyMs >= 800 ? '0.8s-2s' : '<0.8s'

    if (path !== '/api/v1/analytics/events') {
      track('reliability_latency_bucket', {
        source: 'web',
        entity_type: 'api',
        entity_id: path,
        route: path,
        outcome: response.ok ? 'success' : 'fail',
        latency_ms: latencyMs,
        latency_bucket: latencyBucket,
        status_code: response.status,
        retry_attempt: attempt,
      }).catch(() => undefined)
    }

    // Retry on transient server errors for idempotent methods
    if (!response.ok && canRetry && shouldRetry(method, response.status) && attempt < MAX_RETRIES) {
      attempt++
      continue
    }

    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload &
      Partial<ApiEnvelope<T, M>>
    if (!response.ok) {
      if (path !== '/api/v1/analytics/events') {
        track('reliability_api_error', {
          source: 'web',
          entity_type: 'api',
          entity_id: path,
          route: path,
          outcome: 'fail',
          status_code: response.status,
          error_code: payload.error?.code || null,
          retry_attempt: attempt,
        }).catch(() => undefined)
      }
      const errorMsg = payload.error?.message || 'Erro ao executar operação'
      const errorCode = payload.error?.code
      const err = new Error(errorMsg) as Error & { code?: string; status?: number }
      err.code = errorCode
      err.status = response.status
      throw err
    }

    return {
      data: payload.data as T,
      meta: payload.meta,
      requestId: payload.requestId,
    }
  }

  throw lastError || new Error('Erro ao executar operação')
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const payload = await requestApi<T>(path, options)
  return payload.data
}

export async function apiRequestWithMeta<T, M = Record<string, unknown>>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiEnvelope<T, M>> {
  return requestApi<T, M>(path, options)
}
