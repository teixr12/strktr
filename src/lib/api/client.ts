import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/analytics/client'

type ApiErrorPayload = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new Error('Sessão inválida. Faça login novamente.')
  }

  const startedAt = performance.now()
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
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
    }).catch(() => undefined)
  }

  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload & { data?: T }
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
      }).catch(() => undefined)
    }
    throw new Error(payload.error?.message || 'Erro ao executar operação')
  }

  return payload.data as T
}
