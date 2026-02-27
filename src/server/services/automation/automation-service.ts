import { log } from '@/lib/api/logger'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AutomationPreview,
  AutomationRunResult,
  AutomationRule,
  AutomationTrigger,
  UserProfileType,
} from '@/shared/types/roadmap-automation'

export type AutomationTemplateCode =
  | 'lead_followup_initial'
  | 'obra_kickoff_checklist'
  | 'approval_rework_sla'

type TriggerContext = {
  orgId: string
  userId: string
  trigger: AutomationTrigger
  triggerEntityType: string
  triggerEntityId: string
  payload?: Record<string, unknown>
}

type ProposedAction = {
  actionType: 'create_roadmap_action' | 'ensure_checklist_base'
  actionKey: string
  title: string
  description: string
  risk: 'low' | 'medium' | 'high'
  data: Record<string, unknown>
}

type RuleRow = {
  id: string
  org_id: string
  trigger: AutomationTrigger
  template_code: AutomationTemplateCode
  enabled: boolean
  requires_review: boolean
  cooldown_hours: number
  created_by: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const templateRegistry: Record<AutomationTemplateCode, {
  title: string
  defaultRequiresReview: boolean
  buildActions: (ctx: TriggerContext) => ProposedAction[]
}> = {
  lead_followup_initial: {
    title: 'Follow-up inicial de lead',
    defaultRequiresReview: false,
    buildActions: (ctx) => [
      {
        actionType: 'create_roadmap_action',
        actionKey: `${ctx.trigger}:${ctx.triggerEntityId}:lead-followup`,
        title: 'Fazer primeiro contato com o lead criado',
        description: 'Contato inicial em ate 2 horas para aumentar conversao.',
        risk: 'low',
        data: {
          actionCode: `lead_followup_${ctx.triggerEntityId}`,
          sourceModule: 'leads',
          dueInHours: 2,
          href: '/leads',
          priority: 'high',
          estimatedMinutes: 10,
          whyItMatters: 'Primeiro contato rapido aumenta chance de contrato.',
          profileType: 'manager' as UserProfileType,
        },
      },
    ],
  },
  obra_kickoff_checklist: {
    title: 'Kickoff de obra',
    defaultRequiresReview: true,
    buildActions: (ctx) => [
      {
        actionType: 'ensure_checklist_base',
        actionKey: `${ctx.trigger}:${ctx.triggerEntityId}:obra-checklist-base`,
        title: 'Criar checklist base de inicio da obra',
        description: 'Preenche checklist padrao para inicio operacional.',
        risk: 'medium',
        data: {
          obraId: ctx.triggerEntityId,
          checklistName: 'Checklist Inicial (Auto)',
        },
      },
      {
        actionType: 'create_roadmap_action',
        actionKey: `${ctx.trigger}:${ctx.triggerEntityId}:obra-review-checklist`,
        title: 'Revisar checklist inicial da obra',
        description: 'Validar itens criados automaticamente e ajustar prazos.',
        risk: 'low',
        data: {
          actionCode: `obra_kickoff_review_${ctx.triggerEntityId}`,
          sourceModule: 'obras',
          dueInHours: 12,
          href: `/obras/${ctx.triggerEntityId}?tab=checklists`,
          priority: 'high',
          estimatedMinutes: 15,
          whyItMatters: 'Kickoff bem definido reduz retrabalho no campo.',
          profileType: 'manager' as UserProfileType,
        },
      },
    ],
  },
  approval_rework_sla: {
    title: 'Revisao apos reprovacao',
    defaultRequiresReview: false,
    buildActions: (ctx) => [
      {
        actionType: 'create_roadmap_action',
        actionKey: `${ctx.trigger}:${ctx.triggerEntityId}:approval-rework`,
        title: 'Revisar item reprovado e reenviar nova versao',
        description: 'Tratar reprovação do cliente antes do SLA vencer.',
        risk: 'medium',
        data: {
          actionCode: `approval_rework_${ctx.triggerEntityId}`,
          sourceModule: 'financeiro',
          dueInHours: 24,
          href: '/compras',
          priority: 'high',
          estimatedMinutes: 20,
          whyItMatters: 'Reprovações sem resposta atrasam cronograma e caixa.',
          profileType: 'finance' as UserProfileType,
        },
      },
    ],
  },
}

function getDefaultRules(trigger: AutomationTrigger): Array<{
  templateCode: AutomationTemplateCode
  requiresReview: boolean
  cooldownHours: number
}> {
  if (trigger === 'LeadCreated') {
    return [{ templateCode: 'lead_followup_initial', requiresReview: false, cooldownHours: 6 }]
  }
  if (trigger === 'ObraCreated') {
    return [{ templateCode: 'obra_kickoff_checklist', requiresReview: true, cooldownHours: 24 }]
  }
  return [{ templateCode: 'approval_rework_sla', requiresReview: false, cooldownHours: 8 }]
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  return code === '23505'
}

async function hasOutboxAction(
  supabase: SupabaseClient,
  orgId: string,
  actionKey: string
): Promise<boolean> {
  const { data } = await supabase
    .from('automation_outbox')
    .select('id')
    .eq('org_id', orgId)
    .eq('action_key', actionKey)
    .maybeSingle()

  return Boolean(data?.id)
}

async function applyRoadmapAction(
  supabase: SupabaseClient,
  ctx: TriggerContext,
  action: ProposedAction
) {
  const dueInHours = Number(action.data.dueInHours || 6)
  const dueAt = new Date(Date.now() + dueInHours * 60 * 60 * 1000).toISOString()

  const insertPayload = {
    org_id: ctx.orgId,
    user_id: ctx.userId,
    profile_type: String(action.data.profileType || 'manager'),
    action_code: String(action.data.actionCode),
    title: action.title,
    description: action.description,
    status: 'pending',
    due_at: dueAt,
    source_module: String(action.data.sourceModule || 'dashboard'),
    metadata: {
      href: action.data.href,
      priority: action.data.priority || 'medium',
      estimatedMinutes: action.data.estimatedMinutes || 10,
      whyItMatters: action.data.whyItMatters || action.description,
      trigger: ctx.trigger,
      triggerEntityId: ctx.triggerEntityId,
    },
  }

  const { data: existing } = await supabase
    .from('roadmap_actions')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .eq('action_code', insertPayload.action_code)
    .in('status', ['pending', 'in_progress'])
    .maybeSingle()

  if (existing?.id) {
    return { applied: false, message: 'Roadmap action ja existente' }
  }

  const { error } = await supabase.from('roadmap_actions').insert(insertPayload)
  if (error) {
    return { applied: false, message: error.message, error }
  }

  return { applied: true, message: 'Roadmap action criada' }
}

async function ensureChecklistBase(
  supabase: SupabaseClient,
  ctx: TriggerContext,
  action: ProposedAction
) {
  const obraId = String(action.data.obraId || '')
  if (!obraId) {
    return { applied: false, message: 'Obra ausente para checklist base' }
  }

  const checklistName = String(action.data.checklistName || 'Checklist Inicial (Auto)')
  const { data: existingChecklist } = await supabase
    .from('obra_checklists')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('obra_id', obraId)
    .eq('nome', checklistName)
    .maybeSingle()

  let checklistId = existingChecklist?.id || null

  if (!checklistId) {
    const { data: maxOrderRows } = await supabase
      .from('obra_checklists')
      .select('ordem')
      .eq('org_id', ctx.orgId)
      .eq('obra_id', obraId)
      .order('ordem', { ascending: false })
      .limit(1)

    const nextOrder = Number(maxOrderRows?.[0]?.ordem || 0) + 1

    const { data: createdChecklist, error: checklistError } = await supabase
      .from('obra_checklists')
      .insert({
        obra_id: obraId,
        user_id: ctx.userId,
        org_id: ctx.orgId,
        tipo: 'pre_obra',
        nome: checklistName,
        ordem: nextOrder,
      })
      .select('id')
      .single()

    if (checklistError || !createdChecklist?.id) {
      return {
        applied: false,
        message: checklistError?.message || 'Erro ao criar checklist base',
        error: checklistError,
      }
    }

    checklistId = createdChecklist.id
  }

  const baseItems = [
    'Definir responsáveis e contatos-chave',
    'Validar materiais críticos da primeira etapa',
    'Registrar plano inicial no diário da obra',
  ]

  const { data: existingItems } = await supabase
    .from('checklist_items')
    .select('descricao')
    .eq('checklist_id', checklistId)

  const existingDescriptions = new Set((existingItems || []).map((item) => item.descricao))
  const missingItems = baseItems.filter((desc) => !existingDescriptions.has(desc))

  if (missingItems.length > 0) {
    const payload = missingItems.map((descricao, index) => ({
      checklist_id: checklistId,
      descricao,
      concluido: false,
      ordem: index,
      data_limite: null,
    }))

    const { error: itemsError } = await supabase
      .from('checklist_items')
      .insert(payload)

    if (itemsError) {
      return { applied: false, message: itemsError.message, error: itemsError }
    }
  }

  return { applied: true, message: 'Checklist base garantido' }
}

async function applyAction(
  supabase: SupabaseClient,
  ctx: TriggerContext,
  action: ProposedAction
) {
  if (action.actionType === 'create_roadmap_action') {
    return applyRoadmapAction(supabase, ctx, action)
  }
  if (action.actionType === 'ensure_checklist_base') {
    return ensureChecklistBase(supabase, ctx, action)
  }
  return { applied: false, message: `Tipo de acao nao suportado: ${action.actionType}` }
}

async function loadRules(
  supabase: SupabaseClient,
  orgId: string,
  trigger: AutomationTrigger
): Promise<RuleRow[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('org_id', orgId)
    .eq('trigger', trigger)
    .eq('enabled', true)
    .order('created_at', { ascending: true })

  if (error || !data || data.length === 0) {
    return getDefaultRules(trigger).map((rule, index) => ({
      id: `default-${trigger}-${index}`,
      org_id: orgId,
      trigger,
      template_code: rule.templateCode,
      enabled: true,
      requires_review: rule.requiresReview,
      cooldown_hours: rule.cooldownHours,
      created_by: '00000000-0000-0000-0000-000000000000',
      metadata: { synthetic: true },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
  }

  return data as RuleRow[]
}

function buildPreviewFromRules(ctx: TriggerContext, rules: RuleRow[]): AutomationPreview {
  const actions: AutomationPreview['actions'] = []

  for (const rule of rules) {
    const template = templateRegistry[rule.template_code]
    if (!template) continue
    const proposed = template.buildActions(ctx)
    for (const action of proposed) {
      actions.push({
        actionType: action.actionType,
        actionKey: action.actionKey,
        title: action.title,
        description: action.description,
        risk: action.risk,
      })
    }
  }

  return {
    trigger: ctx.trigger,
    templateCode: rules[0]?.template_code || 'lead_followup_initial',
    requiresReview: rules.some((rule) => rule.requires_review),
    actions,
  }
}

export function listAutomationTemplates() {
  return Object.entries(templateRegistry).map(([code, template]) => ({
    code,
    title: template.title,
    defaultRequiresReview: template.defaultRequiresReview,
  }))
}

export async function listAutomationRules(
  supabase: SupabaseClient,
  orgId: string
): Promise<AutomationRule[]> {
  const { data } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  return (data || []).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    trigger: row.trigger,
    templateCode: row.template_code,
    enabled: row.enabled,
    requiresReview: row.requires_review,
    cooldownHours: row.cooldown_hours,
    createdBy: row.created_by,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) as AutomationRule[]
}

export async function previewAutomation(
  supabase: SupabaseClient,
  ctx: TriggerContext
): Promise<AutomationPreview> {
  const rules = await loadRules(supabase, ctx.orgId, ctx.trigger)
  return buildPreviewFromRules(ctx, rules)
}

export async function runAutomation(
  supabase: SupabaseClient,
  ctx: TriggerContext,
  options?: {
    confirm?: boolean
    source?: 'manual' | 'trigger'
  }
): Promise<AutomationRunResult> {
  const rules = await loadRules(supabase, ctx.orgId, ctx.trigger)
  const preview = buildPreviewFromRules(ctx, rules)
  const requiresReview = preview.requiresReview
  const source = options?.source || 'manual'

  const { data: runRow, error: runCreateError } = await supabase
    .from('automation_runs')
    .insert({
      org_id: ctx.orgId,
      rule_id: rules[0]?.id?.startsWith('default-') ? null : rules[0]?.id || null,
      trigger: ctx.trigger,
      trigger_entity_type: ctx.triggerEntityType,
      trigger_entity_id: ctx.triggerEntityId,
      status: source === 'trigger' && requiresReview ? 'pending_review' : 'preview',
      summary: preview.actions.length > 0
        ? `${preview.actions.length} acoes propostas`
        : 'Nenhuma acao sugerida',
      requires_review: requiresReview,
      run_source: source,
      preview,
      result: {},
      created_by: ctx.userId,
    })
    .select('id')
    .single()

  if (runCreateError || !runRow?.id) {
    return {
      runId: '',
      status: 'error',
      applied: 0,
      skipped: 0,
      errors: 1,
      requiresReview,
      message: runCreateError?.message || 'Erro ao registrar execução',
    }
  }

  if (preview.actions.length === 0) {
    return {
      runId: runRow.id,
      status: 'skipped',
      applied: 0,
      skipped: 0,
      errors: 0,
      requiresReview,
      message: 'Sem ações aplicáveis para este gatilho',
    }
  }

  if (requiresReview && !options?.confirm) {
    return {
      runId: runRow.id,
      status: 'pending_review',
      applied: 0,
      skipped: preview.actions.length,
      errors: 0,
      requiresReview,
      message: 'Execução requer revisão/confirmacao',
    }
  }

  let applied = 0
  let skipped = 0
  let errors = 0

  for (const rule of rules) {
    const template = templateRegistry[rule.template_code]
    if (!template) continue

    const actions = template.buildActions(ctx)
    for (const action of actions) {
      try {
        const alreadyApplied = await hasOutboxAction(supabase, ctx.orgId, action.actionKey)
        if (alreadyApplied) {
          skipped += 1
          continue
        }

        const result = await applyAction(supabase, ctx, action)
        if (result.applied) {
          const { error: outboxInsertError } = await supabase
            .from('automation_outbox')
            .insert({
              org_id: ctx.orgId,
              run_id: runRow.id,
              action_type: action.actionType,
              action_key: action.actionKey,
              payload: {
                title: action.title,
                description: action.description,
                trigger: ctx.trigger,
                triggerEntityId: ctx.triggerEntityId,
              },
              applied_at: new Date().toISOString(),
            })

          if (outboxInsertError && !isDuplicateKeyError(outboxInsertError)) {
            log('warn', 'automation.outbox.insert.failed', {
              requestId: 'automation',
              orgId: ctx.orgId,
              userId: ctx.userId,
              runId: runRow.id,
              actionKey: action.actionKey,
              error: outboxInsertError.message,
            })
          }

          applied += 1
        } else if (result.error) {
          errors += 1
        } else {
          skipped += 1
        }
      } catch (error) {
        errors += 1
        log('error', 'automation.action.failed', {
          requestId: 'automation',
          orgId: ctx.orgId,
          userId: ctx.userId,
          runId: runRow.id,
          actionType: action.actionType,
          actionKey: action.actionKey,
          error: error instanceof Error ? error.message : 'unknown',
        })
      }
    }
  }

  const finalStatus: AutomationRunResult['status'] =
    errors > 0 && applied === 0
      ? 'error'
      : applied > 0
        ? 'applied'
        : 'skipped'

  const message =
    finalStatus === 'applied'
      ? `Automação aplicada (${applied} ações).`
      : finalStatus === 'skipped'
        ? 'Nenhuma ação aplicada.'
        : 'Automação falhou.'

  await supabase
    .from('automation_runs')
    .update({
      status: finalStatus,
      summary: message,
      error: errors > 0 ? `${errors} ação(ões) com erro` : null,
      result: { applied, skipped, errors },
    })
    .eq('id', runRow.id)

  return {
    runId: runRow.id,
    status: finalStatus,
    applied,
    skipped,
    errors,
    requiresReview,
    message,
  }
}
