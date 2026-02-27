import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import {
  createAutomationRuleSchema,
} from '@/shared/schemas/roadmap-automation'
import {
  listAutomationRules,
  listAutomationTemplates,
} from '@/server/services/automation/automation-service'

export async function GET(request: Request) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const rules = await listAutomationRules(supabase, orgId)
  return ok(request, { rules }, { flag: 'NEXT_PUBLIC_FF_SEMI_AUTOMATION' })
}

export async function POST(request: Request) {
  const { user, supabase, error, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }

  const permissionError = requireDomainPermission(request, role, 'can_manage_projects')
  if (permissionError) return permissionError

  const parsed = createAutomationRuleSchema.safeParse(await request.json().catch(() => null))
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

  const { data: created, error: createError } = await supabase
    .from('automation_rules')
    .insert({
      org_id: orgId,
      trigger: parsed.data.trigger,
      template_code: parsed.data.templateCode,
      enabled: parsed.data.enabled,
      requires_review: parsed.data.requiresReview,
      cooldown_hours: parsed.data.cooldownHours,
      created_by: user.id,
      metadata: parsed.data.metadata || {},
    })
    .select('*')
    .single()

  if (createError || !created) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: createError?.message || 'Erro ao criar regra' },
      400
    )
  }

  return ok(request, created, { flag: 'NEXT_PUBLIC_FF_SEMI_AUTOMATION' }, 201)
}
