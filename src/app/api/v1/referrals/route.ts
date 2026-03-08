import { randomUUID } from 'node:crypto'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { withReferralAuth } from '@/lib/referral/api'
import { createReferralSchema } from '@/shared/schemas/referral'
import type { ReferralRecord, ReferralSummary } from '@/shared/types/referral'

const REFERRAL_COLUMNS =
  'id, org_id, code, invited_email, referred_name, status, reward_cents, notes, expires_at, sent_at, activated_at, created_at, updated_at'

function normalizeSearchTerm(value: string | null): string | null {
  const normalized = (value || '').trim().replace(/[%_,]/g, '')
  return normalized.length > 0 ? normalized : null
}

function buildSummary(items: Array<Pick<ReferralRecord, 'status' | 'reward_cents'>>): ReferralSummary {
  return {
    total: items.length,
    draft: items.filter((item) => item.status === 'draft').length,
    sent: items.filter((item) => item.status === 'sent').length,
    activated: items.filter((item) => item.status === 'activated').length,
    rewarded: items.filter((item) => item.status === 'rewarded').length,
    expired: items.filter((item) => item.status === 'expired').length,
    totalRewardCents: items.reduce((sum, item) => sum + Number(item.reward_cents || 0), 0),
  }
}

function generateReferralCode() {
  return `STRKTR-${randomUUID().slice(0, 8).toUpperCase()}`
}

export const GET = withReferralAuth('can_manage_team', async (request, { supabase, requestId, orgId, user }) => {
  const { searchParams } = new URL(request.url)
  const status = (searchParams.get('status') || '').trim()
  const search = normalizeSearchTerm(searchParams.get('q'))
  const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 50,
    maxPageSize: 100,
  })

  let query = supabase
    .from('referral_invites')
    .select(REFERRAL_COLUMNS, { count: 'exact' })
    .eq('org_id', orgId)

  if (status) {
    query = query.eq('status', status)
  }

  if (search) {
    query = query.or(`code.ilike.%${search}%,invited_email.ilike.%${search}%,referred_name.ilike.%${search}%`)
  }

  const { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    log('error', 'referrals.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/referrals',
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const { data: summaryRows, error: summaryError } = await supabase
    .from('referral_invites')
    .select('status, reward_cents')
    .eq('org_id', orgId)

  if (summaryError) {
    log('error', 'referrals.summary.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/referrals',
      error: summaryError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: summaryError.message }, 500)
  }

  const total = count ?? data?.length ?? 0

  return ok(
    request,
    (data as ReferralRecord[] | null) ?? [],
    {
      ...buildPaginationMeta(data?.length || 0, total, page, pageSize),
      summary: buildSummary((summaryRows as Array<Pick<ReferralRecord, 'status' | 'reward_cents'>>) || []),
    }
  )
})

export const POST = withReferralAuth('can_manage_team', async (request, { supabase, requestId, orgId, user }) => {
  const parsed = createReferralSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message || 'Payload inválido',
      },
      400
    )
  }

  const nowIso = new Date().toISOString()
  let created: ReferralRecord | null = null
  let lastError: string | null = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateReferralCode()
    const sentAt = parsed.data.status === 'sent' ? nowIso : null
    const activatedAt = parsed.data.status === 'activated' || parsed.data.status === 'rewarded' ? nowIso : null

    const { data, error } = await supabase
      .from('referral_invites')
      .insert({
        org_id: orgId,
        code,
        invited_email: parsed.data.invited_email || null,
        referred_name: parsed.data.referred_name || null,
        status: parsed.data.status,
        reward_cents: parsed.data.reward_cents,
        notes: parsed.data.notes || null,
        expires_at: parsed.data.expires_at || null,
        sent_at: sentAt,
        activated_at: activatedAt,
        created_by: user.id,
        updated_by: user.id,
        updated_at: nowIso,
      })
      .select(REFERRAL_COLUMNS)
      .single()

    if (!error && data) {
      created = data as ReferralRecord
      break
    }

    lastError = error?.message || 'Falha ao criar indicação'

    if (!error?.message?.toLowerCase().includes('duplicate') && error?.code !== '23505') {
      break
    }
  }

  if (!created) {
    log('error', 'referrals.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/referrals',
      error: lastError,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: lastError || 'Falha ao criar indicação' }, 500)
  }

  return ok(request, created, undefined, 201)
})
