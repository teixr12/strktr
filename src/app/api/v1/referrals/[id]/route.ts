import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { withReferralAuth } from '@/lib/referral/api'
import { updateReferralSchema } from '@/shared/schemas/referral'
import type { ReferralRecord } from '@/shared/types/referral'

const REFERRAL_COLUMNS =
  'id, org_id, code, invited_email, referred_name, status, reward_cents, notes, expires_at, sent_at, activated_at, created_at, updated_at'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  return withReferralAuth('can_manage_team', async (innerRequest, { supabase, requestId, orgId, user }) => {
    const { data, error } = await supabase
      .from('referral_invites')
      .select(REFERRAL_COLUMNS)
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      log('error', 'referrals.getById.failed', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/referrals/[id]',
        error: error.message,
      })
      return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
    }

    if (!data) {
      return fail(innerRequest, { code: API_ERROR_CODES.NOT_FOUND, message: 'Indicação não encontrada' }, 404)
    }

    return ok(innerRequest, data as ReferralRecord)
  })(request)
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  return withReferralAuth('can_manage_team', async (innerRequest, { supabase, requestId, orgId, user }) => {
    const parsed = updateReferralSchema.safeParse(await innerRequest.json().catch(() => null))
    if (!parsed.success) {
      return fail(
        innerRequest,
        {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: parsed.error.issues[0]?.message || 'Payload inválido',
        },
        400
      )
    }

    const nowIso = new Date().toISOString()
    const nextStatus = parsed.data.status
    const payload = {
      invited_email: parsed.data.invited_email ?? undefined,
      referred_name: parsed.data.referred_name ?? undefined,
      status: nextStatus,
      reward_cents: parsed.data.reward_cents ?? undefined,
      notes: parsed.data.notes ?? undefined,
      expires_at: parsed.data.expires_at ?? undefined,
      sent_at:
        nextStatus === 'sent'
          ? nowIso
          : nextStatus
            ? null
            : undefined,
      activated_at:
        nextStatus === 'activated' || nextStatus === 'rewarded'
          ? nowIso
          : nextStatus
            ? null
            : undefined,
      updated_by: user.id,
      updated_at: nowIso,
    }

    const { data, error } = await supabase
      .from('referral_invites')
      .update(payload)
      .eq('org_id', orgId)
      .eq('id', id)
      .select(REFERRAL_COLUMNS)
      .maybeSingle()

    if (error) {
      log('error', 'referrals.update.failed', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/referrals/[id]',
        error: error.message,
      })
      return fail(innerRequest, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
    }

    if (!data) {
      return fail(innerRequest, { code: API_ERROR_CODES.NOT_FOUND, message: 'Indicação não encontrada' }, 404)
    }

    return ok(innerRequest, data as ReferralRecord)
  })(request)
}
