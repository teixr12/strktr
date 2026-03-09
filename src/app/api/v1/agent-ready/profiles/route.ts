import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { withAgentReadyAuth } from '@/lib/agent-ready/api'
import { agentReadyProfileCreateSchema } from '@/shared/schemas/agent-ready'
import type { AgentReadyProfile, AgentReadyProfileSummary } from '@/shared/types/agent-ready'

const AGENT_READY_PROFILE_COLUMNS =
  'id, org_id, name, agent_type, status, scope_codes, action_codes, notes, created_at, updated_at'

function buildSummary(items: Array<Pick<AgentReadyProfile, 'status'>>): AgentReadyProfileSummary {
  return {
    total: items.length,
    draft: items.filter((item) => item.status === 'draft').length,
    active: items.filter((item) => item.status === 'active').length,
    paused: items.filter((item) => item.status === 'paused').length,
    revoked: items.filter((item) => item.status === 'revoked').length,
  }
}

export const GET = withAgentReadyAuth('can_manage_team', async (request, { supabase, requestId, orgId, user }) => {
  const { searchParams } = new URL(request.url)
  const status = (searchParams.get('status') || '').trim()
  const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 50,
    maxPageSize: 100,
  })

  let query = supabase
    .from('agent_ready_profiles')
    .select(AGENT_READY_PROFILE_COLUMNS, { count: 'exact' })
    .eq('org_id', orgId)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    log('error', 'agent_ready_profiles.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/agent-ready/profiles',
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const { data: summaryRows, error: summaryError } = await supabase
    .from('agent_ready_profiles')
    .select('status')
    .eq('org_id', orgId)

  if (summaryError) {
    log('error', 'agent_ready_profiles.summary.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/agent-ready/profiles',
      error: summaryError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: summaryError.message }, 500)
  }

  const total = count ?? data?.length ?? 0

  return ok(
    request,
    (data as AgentReadyProfile[] | null) ?? [],
    {
      ...buildPaginationMeta(data?.length || 0, total, page, pageSize),
      summary: buildSummary((summaryRows as Array<Pick<AgentReadyProfile, 'status'>>) || []),
    }
  )
})

export const POST = withAgentReadyAuth('can_manage_team', async (request, { supabase, requestId, orgId, user }) => {
  const parsed = agentReadyProfileCreateSchema.safeParse(await request.json().catch(() => null))
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

  const { data, error } = await supabase
    .from('agent_ready_profiles')
    .insert({
      org_id: orgId,
      name: parsed.data.name,
      agent_type: parsed.data.agent_type,
      status: 'draft',
      scope_codes: parsed.data.scope_codes,
      action_codes: parsed.data.action_codes,
      notes: parsed.data.notes || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(AGENT_READY_PROFILE_COLUMNS)
    .single()

  if (error || !data) {
    log('error', 'agent_ready_profiles.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/agent-ready/profiles',
      error: error?.message || 'Falha ao criar perfil agent-ready',
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error?.message || 'Falha ao criar perfil agent-ready' }, 500)
  }

  return ok(request, data as AgentReadyProfile, undefined, 201)
})
