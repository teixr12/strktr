import { NextResponse } from 'next/server'
import { getRequestId } from '@/lib/api/response'

export function legacyOk<T>(
  request: Request,
  legacyPayload: Record<string, unknown>,
  data: T,
  status = 200
) {
  return NextResponse.json(
    {
      ...legacyPayload,
      data,
      meta: {
        contractVersion: 'v1',
        compatibility: 'legacy',
      },
      requestId: getRequestId(request),
    },
    { status }
  )
}

export function legacyFail(
  request: Request,
  message: string,
  status = 400,
  code = 'LEGACY_ERROR'
) {
  return NextResponse.json(
    {
      error: message,
      errorDetail: {
        code,
        message,
      },
      requestId: getRequestId(request),
    },
    { status }
  )
}
