import { withApiAuth } from '@/lib/api/with-auth'
import { ok } from '@/lib/api/response'
import { getProgramStatusPayload } from '@/server/program/program-status'
import type { ProgramStatusPayload } from '@/shared/types/program-status'

export const GET = withApiAuth(null, async (request) => {
  const payload: ProgramStatusPayload = getProgramStatusPayload()
  return ok(request, payload)
})
