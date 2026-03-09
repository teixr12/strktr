import { ok } from '@/lib/api/response'
import { withSuperAdminAuth } from '@/lib/super-admin/api'
import type {
  SuperAdminChecklistItem,
  SuperAdminReadinessSummary,
  SuperAdminSurface,
} from '@/shared/types/super-admin'

type Meta = {
  summary: SuperAdminReadinessSummary
  checklist: SuperAdminChecklistItem[]
}

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

function buildChecklist(): SuperAdminChecklistItem[] {
  const distributedRateLimitReady = hasAnyEnv([
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'REDIS_URL',
  ])
  const webhookSigningReady = hasAnyEnv(['WEBHOOK_SHARED_TOKEN'])

  return [
    {
      key: 'tenant-boundaries',
      label: 'Tenant boundaries e RLS auditado',
      status: 'ready',
      detail: 'A base atual já usa org_id, RLS e audits contínuos como linha mínima de segurança.',
    },
    {
      key: 'audit-log',
      label: 'Audit log de operações globais',
      status: 'planned',
      detail: 'Ainda falta uma trilha explícita de ações globais sensíveis por operador interno.',
    },
    {
      key: 'distributed-rate-limit',
      label: 'Rate limit distribuído para superfícies globais',
      status: distributedRateLimitReady ? 'ready' : 'blocked',
      detail: distributedRateLimitReady
        ? 'A infraestrutura suporta limitação forte para rotas de alto impacto.'
        : 'Sem rate limit distribuído, o super-admin não deve abrir além do uso interno controlado.',
    },
    {
      key: 'signed-internal-ops',
      label: 'Operações internas assinadas/segregadas',
      status: webhookSigningReady ? 'ready' : 'blocked',
      detail: webhookSigningReady
        ? 'Existe base de signing para evoluir handshakes internos e ações críticas.'
        : 'Sem signing interno mínimo, operações globais permanecem restritas.',
    },
    {
      key: 'privacy-consent',
      label: 'Controles de privacidade e consentimento',
      status: 'planned',
      detail: 'A visão global precisa de escopo legal e política de retenção antes de general release.',
    },
  ]
}

function buildSurfaces(): SuperAdminSurface[] {
  return [
    {
      code: 'tenant-governance',
      label: 'Governança de tenants',
      description: 'Visão global para saúde, rollout, flags e isolamento operacional entre organizações.',
      category: 'tenancy',
      riskLevel: 'high',
      exposureState: 'internal_only',
      complianceGated: true,
      recommendedAction: 'Abrir primeiro como painel interno sem write cross-tenant.',
    },
    {
      code: 'security-oversight',
      label: 'Oversight de segurança',
      description: 'Indicadores globais de RLS, incidentes, drift e readiness de domínios sensíveis.',
      category: 'security',
      riskLevel: 'high',
      exposureState: 'beta_ready',
      complianceGated: false,
      recommendedAction: 'Usar health, audits e telemetry atuais antes de liberar qualquer ação global.',
    },
    {
      code: 'ops-observability',
      label: 'Observabilidade operacional',
      description: 'Acompanhamento central de p95, 5xx, rollout e qualidade por domínio.',
      category: 'observability',
      riskLevel: 'medium',
      exposureState: 'beta_ready',
      complianceGated: false,
      recommendedAction: 'Conectar esse readiness ao programa e aos relatórios operacionais.',
    },
    {
      code: 'billing-governance',
      label: 'Billing governance',
      description: 'Visão global de readiness de cobrança, risco e compliance por organização.',
      category: 'billing',
      riskLevel: 'high',
      exposureState: 'setup_required',
      complianceGated: true,
      recommendedAction: 'Manter read-only até billing, audit log e consentimento estarem fechados.',
    },
    {
      code: 'global-insights',
      label: 'Insights globais e compliance',
      description: 'Agregações cross-tenant só podem abrir com anonimização e política formal de acesso.',
      category: 'compliance',
      riskLevel: 'high',
      exposureState: 'planned',
      complianceGated: true,
      recommendedAction: 'Bloquear general release até fechar anonimização, retenção e base legal.',
    },
  ]
}

function buildSummary(
  items: SuperAdminSurface[],
  checklist: SuperAdminChecklistItem[]
): SuperAdminReadinessSummary {
  return {
    totalSurfaces: items.length,
    internalOnly: items.filter((item) => item.exposureState === 'internal_only').length,
    betaReady: items.filter((item) => item.exposureState === 'beta_ready').length,
    setupRequired: items.filter((item) => item.exposureState === 'setup_required').length,
    planned: items.filter((item) => item.exposureState === 'planned').length,
    complianceGated: items.filter((item) => item.complianceGated).length,
    checklistReady: checklist.filter((item) => item.status === 'ready').length,
    checklistBlocked: checklist.filter((item) => item.status === 'blocked').length,
  }
}

export const GET = withSuperAdminAuth('can_manage_team', async (request) => {
  const checklist = buildChecklist()
  const items = buildSurfaces()

  return ok(request, items, {
    summary: buildSummary(items, checklist),
    checklist,
  } satisfies Meta)
})
