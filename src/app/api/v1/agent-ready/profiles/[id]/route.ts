import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withAgentReadyAuth } from '@/lib/agent-ready/api'
import { agentReadyProfilePatchSchema } from '@/shared/schemas/agent-ready'
import type { AgentReadyProfile } from '@/shared/types/agent-ready'

const AGENT_READY_PROFILE_COLUMNS =
  'id, org_id, name, agent_type, status, scope_codes, action_codes, notes, created_at, updated_at'

function resolveProfileId(request: Request): string | null {
  const pathname = new URL(request.url).pathname
  const id = pathname.split('/').filter(Boolean).at(-1)?.trim() || ''
  return id || null
}

export const PATCH = withAgentReadyAuth('can_manage_team', async (request, { supabase, orgId, user }) => {
  const id = resolveProfileId(request)
  if (!id) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'id inválido' }, 400)
  }

  const parsed = agentReadyProfilePatchSchema.safeParse(await request.json().catch(() => null))
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

  const updates: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.agent_type !== undefined) updates.agent_type = parsed.data.agent_type
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.scope_codes !== undefined) updates.scope_codes = parsed.data.scope_codes
  if (parsed.data.action_codes !== undefined) updates.action_codes = parsed.data.action_codes
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes || null

  const { data, error } = await supabase
    .from('agent_ready_profiles')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select(AGENT_READY_PROFILE_COLUMNS)
    .maybeSingle()

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }
  if (!data) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Perfil agent-ready não encontrado' }, 404)
  }

  return ok(request, data as AgentReadyProfile)
})
