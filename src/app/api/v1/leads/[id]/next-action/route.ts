import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { emitProductEvent } from '@/lib/telemetry'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'

const actionByStatus: Record<string, { action: string; priority: 'low' | 'medium' | 'high'; etaHours: number }> = {
  Novo: { action: 'Fazer primeiro contato por WhatsApp/telefone', priority: 'high', etaHours: 2 },
  Qualificado: { action: 'Agendar visita técnica', priority: 'high', etaHours: 24 },
  Proposta: { action: 'Enviar follow-up de proposta e validar objeções', priority: 'medium', etaHours: 24 },
  Negociação: { action: 'Conduzir fechamento com condições comerciais', priority: 'high', etaHours: 12 },
  Fechado: { action: 'Iniciar onboarding de projeto/obra', priority: 'low', etaHours: 48 },
  Perdido: { action: 'Registrar motivo de perda e criar lembrete de reativação', priority: 'low', etaHours: 168 },
}

export async function POST(
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
  const permissionError = requireDomainPermission(request, role, 'can_manage_leads')
  if (permissionError) return permissionError

  const { id } = await params
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, nome, status, temperatura, valor_potencial, ultimo_contato')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (leadError || !lead) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Lead não encontrado' }, 404)
  }

  const base = actionByStatus[lead.status] || actionByStatus.Novo
  const hotBoost = lead.temperatura === 'Hot' ? 1 : 0
  const overdueContact = lead.ultimo_contato
    ? (Date.now() - new Date(lead.ultimo_contato).getTime()) / (1000 * 60 * 60 * 24) > 3
    : true

  const score = Math.min(
    100,
    40 +
      (lead.valor_potencial ? Math.min(40, lead.valor_potencial / 25000) : 0) +
      (hotBoost ? 15 : 0) +
      (overdueContact ? 10 : 0)
  )

  await emitProductEvent({
    supabase,
    orgId,
    userId: user.id,
    eventType: 'LeadNextActionSuggested',
    entityType: 'lead',
    entityId: lead.id,
    payload: { status: lead.status, temperatura: lead.temperatura, score },
  }).catch(() => undefined)

  return ok(request, {
    leadId: lead.id,
    leadNome: lead.nome,
    recommendation: base.action,
    recommended: base.action,
    priority: base.priority,
    etaHours: base.etaHours,
    score,
    reason: {
      status: lead.status,
      temperatura: lead.temperatura,
      overdueContact,
    },
  })
}
