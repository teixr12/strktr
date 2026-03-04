import { z } from 'zod'
import { withApiAuth, type AuthContext } from '@/lib/api/with-auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import type { DomainPermission } from '@/lib/auth/domain-permissions'
import { getLatencyBucket } from '@/platform/observability/latency'

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type AuthMode =
  | { kind: 'public' }
  | { kind: 'member' }
  | { kind: 'permission'; permission: DomainPermission }

type IdempotencyOptions = {
  enabled?: boolean
  keyHeader?: string
  ttlMs?: number
  methods?: RequestMethod[]
}

export type IdempotencyContext = {
  enabled: boolean
  key: string | null
  isReplay: boolean
}

type HandlerParams<T> = Promise<T> | T
type EmptyParams = Record<string, never>
type RouteContext<TParams extends Record<string, string>> = {
  params: Promise<TParams>
}
type RouteExecutor<TParams extends Record<string, string>> = keyof TParams extends never
  ? (request: Request) => Promise<Response>
  : (request: Request, routeContext: RouteContext<TParams>) => Promise<Response>

type ParseInputMode = 'body' | 'query' | 'auto'

interface CreateApiRouteOptions<TInput, TOutput, TParams extends Record<string, string>> {
  auth: AuthMode
  inputSchema?: z.ZodType<TInput>
  outputSchema?: z.ZodType<TOutput>
  inputMode?: ParseInputMode
  flag?: string
  idempotency?: IdempotencyOptions
  handler: (ctx: {
    request: Request
    params: HandlerParams<TParams>
    auth: AuthContext | null
    input: TInput | null
    idempotency: IdempotencyContext
  }) => Promise<TOutput | Response>
}

const DEFAULT_IDEMPOTENCY_METHODS: RequestMethod[] = ['POST', 'PUT', 'PATCH']
const idempotencyStore = new Map<string, number>()

function sanitizeIdempotencyStore(ttlMs: number) {
  const now = Date.now()
  for (const [key, expiresAt] of idempotencyStore.entries()) {
    if (expiresAt <= now || expiresAt > now + ttlMs * 4) idempotencyStore.delete(key)
  }
}

function resolveInputMode(request: Request, mode: ParseInputMode): 'body' | 'query' {
  if (mode !== 'auto') return mode
  return request.method === 'GET' || request.method === 'DELETE' ? 'query' : 'body'
}

async function parseInput<TInput>(
  request: Request,
  schema: z.ZodType<TInput> | undefined,
  inputMode: ParseInputMode
): Promise<{ data: TInput | null; errorResponse: Response | null }> {
  if (!schema) return { data: null, errorResponse: null }

  const mode = resolveInputMode(request, inputMode)
  const raw =
    mode === 'query'
      ? Object.fromEntries(new URL(request.url).searchParams.entries())
      : await request.json().catch(() => null)

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      data: null,
      errorResponse: fail(
        request,
        {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: parsed.error.issues[0]?.message || 'Payload inválido',
          details: parsed.error.issues,
        },
        400
      ),
    }
  }

  return { data: parsed.data, errorResponse: null }
}

function buildIdempotencyContext(
  request: Request,
  auth: AuthContext | null,
  options?: IdempotencyOptions
): IdempotencyContext {
  const enabled = Boolean(options?.enabled)
  if (!enabled) {
    return { enabled: false, key: null, isReplay: false }
  }

  const methods = options?.methods || DEFAULT_IDEMPOTENCY_METHODS
  if (!methods.includes(request.method as RequestMethod)) {
    return { enabled: true, key: null, isReplay: false }
  }

  const headerName = options?.keyHeader || 'idempotency-key'
  const key = request.headers.get(headerName)
  if (!key) return { enabled: true, key: null, isReplay: false }

  const ttlMs = options?.ttlMs ?? 5 * 60 * 1000
  sanitizeIdempotencyStore(ttlMs)

  const path = new URL(request.url).pathname
  const actor = auth?.user.id || 'public'
  const fingerprint = `${request.method}:${path}:${actor}:${key}`
  const now = Date.now()
  const expiresAt = idempotencyStore.get(fingerprint)
  if (expiresAt && expiresAt > now) {
    return { enabled: true, key, isReplay: true }
  }

  idempotencyStore.set(fingerprint, now + ttlMs)
  return { enabled: true, key, isReplay: false }
}

function withBaseMeta(flag?: string, latencyMs?: number) {
  return {
    ...(flag ? { flag } : {}),
    ...(typeof latencyMs === 'number'
      ? {
          latencyMs,
          latencyBucket: getLatencyBucket(latencyMs),
        }
      : {}),
  }
}

export function createApiRoute<
  TInput = null,
  TOutput = unknown,
  TParams extends Record<string, string> = EmptyParams,
>(options: CreateApiRouteOptions<TInput, TOutput, TParams>) {
  const inputMode = options.inputMode || 'auto'

  const execute = async (
    request: Request,
    routeContext?: RouteContext<TParams>
  ): Promise<Response> => {
    const startedAt = Date.now()
    const params = routeContext?.params ?? Promise.resolve({} as TParams)

    const parsedInput = await parseInput(request, options.inputSchema, inputMode)
    if (parsedInput.errorResponse) return parsedInput.errorResponse

    const handle = async (auth: AuthContext | null) => {
      const idempotency = buildIdempotencyContext(request, auth, options.idempotency)
      const output = await options.handler({
        request,
        params,
        auth,
        input: parsedInput.data,
        idempotency,
      })
      if (output instanceof Response) return output

      if (options.outputSchema) {
        const validated = options.outputSchema.safeParse(output)
        if (!validated.success) {
          return fail(
            request,
            {
              code: API_ERROR_CODES.DB_ERROR,
              message: 'Resposta inválida para contrato de saída',
              details: validated.error.issues,
            },
            500
          )
        }
      }

      const latencyMs = Date.now() - startedAt
      return ok(request, output as TOutput, withBaseMeta(options.flag, latencyMs))
    }

    if (options.auth.kind === 'public') {
      return handle(null)
    }

    if (options.auth.kind === 'member') {
      const secured = withApiAuth(null, async (_innerRequest, auth) => handle(auth))
      return secured(request)
    }

    const secured = withApiAuth(options.auth.permission, async (_innerRequest, auth) => handle(auth))
    return secured(request)
  }

  return execute as RouteExecutor<TParams>
}
