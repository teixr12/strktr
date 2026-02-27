import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateAutomationRuleSchema } from '@/shared/schemas/roadmap-automation'
import { listAutomationTemplates } from '@/server/services/automation/automation-service'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const parsed = updateAutomationRuleSchema.safeParse(await request.json().catch(() => null))
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

  if (parsed.data.templateCode) {
    const templateExists = listAutomationTemplates().some((template) => template.code === parsed.data.templateCode)
    if (!templateExists) {
      return fail(
        request,
        {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'Template de automação inválido',
        },
        400
      )
    }
  }

  const { id } = await params

  const updatePayload: Record<string, unknown> = {}
  if (parsed.data.trigger !== undefined) updatePayload.trigger = parsed.data.trigger
  if (parsed.data.templateCode !== undefined) updatePayload.template_code = parsed.data.templateCode
  if (parsed.data.enabled !== undefined) updatePayload.enabled = parsed.data.enabled
  if (parsed.data.requiresReview !== undefined) updatePayload.requires_review = parsed.data.requiresReview
  if (parsed.data.cooldownHours !== undefined) updatePayload.cooldown_hours = parsed.data.cooldownHours
  if (parsed.data.metadata !== undefined) updatePayload.metadata = parsed.data.metadata
  updatePayload.updated_at = new Date().toISOString()

  const { data: updated, error: updateError } = await supabase
    .from('automation_rules')
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (updateError || !updated) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.NOT_FOUND,
        message: 'Regra de automação não encontrada',
      },
      404
    )
  }

  return ok(request, updated, { flag: 'NEXT_PUBLIC_FF_SEMI_AUTOMATION' })
}
