import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/types/database'
import type {
  RoadmapAction,
  RoadmapProgress,
  UserProfileType,
} from '@/shared/types/roadmap-automation'

function hasKeyword(value: string | null | undefined, keyword: string): boolean {
  return (value || '').toLowerCase().includes(keyword)
}

export function resolveProfileType(role: UserRole | null, cargo?: string | null): UserProfileType {
  if (role === 'admin') return 'owner'
  if (role === 'manager') return 'manager'

  if (hasKeyword(cargo, 'arquit')) return 'architect'
  if (hasKeyword(cargo, 'finan')) return 'finance'
  if (hasKeyword(cargo, 'obra') || hasKeyword(cargo, 'campo')) return 'field'
  return 'field'
}

type RoadmapCandidate = {
  actionCode: string
  title: string
  description: string
  sourceModule: string
  dueInHours: number
  priority: 'high' | 'medium' | 'low'
  href: string
  estimatedMinutes: number
  whyItMatters: string
}

function buildCandidates(profileType: UserProfileType, metrics: {
  blockedStages: number
  pendingApprovals: number
  staleLeads: number
  overdueVisits: number
  activeObras: number
}) {
  const candidates: RoadmapCandidate[] = []

  if (metrics.blockedStages > 0) {
    candidates.push({
      actionCode: 'resolve_blocked_stages',
      title: `Resolver ${metrics.blockedStages} etapa(s) bloqueada(s)`,
      description: 'Destrave o cronograma para evitar atraso em cadeia.',
      sourceModule: 'obras',
      dueInHours: 4,
      priority: 'high',
      href: '/obras',
      estimatedMinutes: 15,
      whyItMatters: 'Etapas bloqueadas impactam prazo e margem da obra.',
    })
  }

  if (metrics.pendingApprovals > 0) {
    candidates.push({
      actionCode: 'clear_pending_approvals',
      title: `Tratar ${metrics.pendingApprovals} aprovação(ões) pendente(s)`,
      description: 'Avance as decisões para evitar gargalos com cliente.',
      sourceModule: 'compras',
      dueInHours: 6,
      priority: 'high',
      href: '/compras',
      estimatedMinutes: 20,
      whyItMatters: 'Pendências de aprovação travam compras e cronograma.',
    })
  }

  if (metrics.staleLeads > 0 && (profileType === 'owner' || profileType === 'manager')) {
    candidates.push({
      actionCode: 'followup_stale_leads',
      title: `Retomar ${metrics.staleLeads} lead(s) sem contato recente`,
      description: 'Dispare follow-up para recuperar oportunidades.',
      sourceModule: 'leads',
      dueInHours: 8,
      priority: 'medium',
      href: '/leads',
      estimatedMinutes: 25,
      whyItMatters: 'Resposta rápida aumenta conversão comercial.',
    })
  }

  if (metrics.overdueVisits > 0 && (profileType === 'architect' || profileType === 'manager')) {
    candidates.push({
      actionCode: 'reschedule_overdue_visits',
      title: `Reagendar ${metrics.overdueVisits} visita(s) atrasada(s)`,
      description: 'Priorize visitas críticas para manter cadência de obra.',
      sourceModule: 'agenda',
      dueInHours: 10,
      priority: 'medium',
      href: '/agenda',
      estimatedMinutes: 15,
      whyItMatters: 'Visitas em atraso reduzem previsibilidade da execução.',
    })
  }

  if (metrics.activeObras === 0) {
    candidates.push({
      actionCode: 'create_first_obra',
      title: 'Criar primeira obra ativa',
      description: 'Comece uma obra para habilitar execução, checklists e diário.',
      sourceModule: 'obras',
      dueInHours: 24,
      priority: 'high',
      href: '/obras',
      estimatedMinutes: 10,
      whyItMatters: 'Sem obra ativa, o time não captura valor operacional.',
    })
  }

  if (candidates.length === 0) {
    candidates.push({
      actionCode: 'daily_system_review',
      title: 'Revisão diária da operação',
      description: 'Confirme prioridades do dia e mantenha equipe alinhada.',
      sourceModule: 'dashboard',
      dueInHours: 12,
      priority: 'low',
      href: '/dashboard',
      estimatedMinutes: 10,
      whyItMatters: 'Rotina diária reduz risco e mantém ritmo de execução.',
    })
  }

  return candidates.slice(0, 4)
}

export async function ensureRoadmapForUser(params: {
  supabase: SupabaseClient
  orgId: string
  userId: string
  role: UserRole | null
}) {
  const { supabase, orgId, userId, role } = params

  const [{ data: profile }, blockedStagesRes, approvalsRes, leadsRes, visitsRes, obrasRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('cargo')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('obra_etapas')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'Bloqueada'),
    supabase
      .from('aprovacoes_cliente')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'pendente'),
    supabase
      .from('leads')
      .select('id, ultimo_contato')
      .eq('org_id', orgId)
      .in('status', ['Novo', 'Qualificado', 'Proposta']),
    supabase
      .from('visitas')
      .select('id, data_hora, status')
      .eq('org_id', orgId)
      .eq('status', 'Agendado'),
    supabase
      .from('obras')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'Em Andamento'),
  ])

  const profileType = resolveProfileType(role, profile?.cargo || null)

  const staleLeads = (leadsRes.data || []).filter((lead) => {
    if (!lead.ultimo_contato) return true
    const days = (Date.now() - new Date(lead.ultimo_contato).getTime()) / (1000 * 60 * 60 * 24)
    return days > 3
  }).length

  const overdueVisits = (visitsRes.data || []).filter((visit) => {
    return new Date(visit.data_hora).getTime() < Date.now()
  }).length

  const metrics = {
    blockedStages: blockedStagesRes.count || 0,
    pendingApprovals: approvalsRes.count || 0,
    staleLeads,
    overdueVisits,
    activeObras: obrasRes.count || 0,
  }

  const candidates = buildCandidates(profileType, metrics)

  const { data: existingRows } = await supabase
    .from('roadmap_actions')
    .select('id, action_code, status, created_at')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const existingCodes = new Set(
    (existingRows || [])
      .filter((row) => row.status === 'pending' || row.status === 'in_progress')
      .map((row) => row.action_code)
  )

  const missingCandidates = candidates.filter((candidate) => !existingCodes.has(candidate.actionCode))

  if (missingCandidates.length > 0) {
    const rows = missingCandidates.map((candidate) => ({
      org_id: orgId,
      user_id: userId,
      profile_type: profileType,
      action_code: candidate.actionCode,
      title: candidate.title,
      description: candidate.description,
      status: 'pending',
      due_at: new Date(Date.now() + candidate.dueInHours * 60 * 60 * 1000).toISOString(),
      source_module: candidate.sourceModule,
      metadata: {
        priority: candidate.priority,
        estimatedMinutes: candidate.estimatedMinutes,
        href: candidate.href,
        whyItMatters: candidate.whyItMatters,
      },
    }))

    await supabase.from('roadmap_actions').insert(rows)
  }

  const { data: roadmapRows } = await supabase
    .from('roadmap_actions')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(8)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count: completedTodayCount } = await supabase
    .from('roadmap_actions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', todayStart.toISOString())

  const actions: RoadmapAction[] = (roadmapRows || []).map((row) => ({
    id: row.id,
    actionCode: row.action_code,
    title: row.title,
    description: row.description,
    status: row.status,
    dueAt: row.due_at,
    sourceModule: row.source_module,
    profileType: row.profile_type,
    priority: String(row.metadata?.priority || 'medium') as RoadmapAction['priority'],
    estimatedMinutes: Number(row.metadata?.estimatedMinutes || 10),
    href: String(row.metadata?.href || '/dashboard'),
    whyItMatters: String(row.metadata?.whyItMatters || row.description || 'Importante para manter a operação previsível.'),
  }))

  const progress: RoadmapProgress = {
    total: actions.length + (completedTodayCount || 0),
    pending: actions.length,
    completedToday: completedTodayCount || 0,
  }

  return {
    profileType,
    progress,
    actions,
  }
}
