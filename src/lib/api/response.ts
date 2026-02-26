import { NextResponse } from 'next/server'

export interface ApiErrorPayload {
  code: string
  message: string
  details?: unknown
}

export interface ApiSuccessMeta {
  contractVersion: 'v1'
  deprecation?: {
    sunsetAt: string
    alternative?: string
    message?: string
  }
  flag?: string
  [key: string]: unknown
}

export function getRequestId(request: Request): string {
  return request.headers.get('x-request-id') || crypto.randomUUID()
}

export function ok<T>(
  request: Request,
  data: T,
  meta?: Record<string, unknown>,
  status = 200
) {
  const mergedMeta: ApiSuccessMeta = {
    contractVersion: 'v1',
    ...(meta || {}),
  }

  return NextResponse.json(
    {
      data,
      meta: mergedMeta,
      requestId: getRequestId(request),
    },
    { status }
  )
}

export function fail(
  request: Request,
  error: ApiErrorPayload,
  status = 400
) {
  return NextResponse.json(
    {
      error,
      requestId: getRequestId(request),
    },
    { status }
  )
}
