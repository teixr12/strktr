import { ok } from '@/lib/api/response'
import { withBigDataAuth } from '@/lib/big-data/api'
import type {
  BigDataChecklistItem,
  BigDataReadinessSummary,
  BigDataSurface,
} from '@/shared/types/big-data'

type Meta = {
  summary: BigDataReadinessSummary
  checklist: BigDataChecklistItem[]
}

function hasAnyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(process.env[key]?.trim()))
}

function buildChecklist(): BigDataChecklistItem[] {
  const analyticsMirrorReady = hasAnyEnv([
    'NEXT_PUBLIC_POSTHOG_KEY',
    'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN',
    'POSTHOG_PROJECT_TOKEN',
    'POSTHOG_PROJECT_API_KEY',
  ])
  const storageReady = hasAnyEnv([
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ])
  const distributedRateLimitReady = hasAnyEnv([
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'REDIS_URL',
  ])

  return [
    {
      key: 'tenant-safe-aggregation',
      label: 'Agregação segura por tenant',
      status: 'ready',
      detail: 'A base atual já opera com org_id, RLS e rollout por organização para bloquear exposição acidental.',
    },
    {
      key: 'privacy-anonymization',
      label: 'Anonimização e retenção',
      status: 'planned',
      detail: 'Ainda falta política formal de anonimização, retenção e base legal para insights regionais.',
    },
    {
      key: 'analytics-sources',
      label: 'Fonte de analytics e telemetria',
      status: analyticsMirrorReady ? 'ready' : 'blocked',
      detail: analyticsMirrorReady
        ? 'A camada atual já consegue espelhar telemetria operacional para evoluir agregações.'
        : 'Sem fonte de analytics confiável, o domínio de big data não deve avançar além do planejamento.',
    },
    {
      key: 'data-storage-foundation',
      label: 'Base de armazenamento e ingestão',
      status: storageReady ? 'ready' : 'blocked',
      detail: storageReady
        ? 'A infraestrutura principal já suporta persistência e evolução de pipelines controlados.'
        : 'Sem storage consistente, qualquer pipeline de dados fica bloqueado.',
    },
    {
      key: 'abuse-controls',
      label: 'Controles contra abuso e varredura',
      status: distributedRateLimitReady ? 'ready' : 'blocked',
      detail: distributedRateLimitReady
        ? 'Existe base para limitar ingestão e consultas sensíveis em estágios posteriores.'
        : 'Sem rate limit distribuído, qualquer surface global de dados continua bloqueada.',
    },
  ]
}

function buildSurfaces(): BigDataSurface[] {
  return [
    {
      code: 'regional-insights',
      label: 'Insights regionais',
      description: 'Tendências por região, cidade e categoria com agregações seguras e sem identificar tenants.',
      category: 'insights',
      riskLevel: 'high',
      exposureState: 'planned',
      complianceGated: true,
      recommendedAction: 'Abrir só depois de anonimização, retenção e política de acesso estarem fechadas.',
    },
    {
      code: 'cost-benchmarks',
      label: 'Benchmarks de custo',
      description: 'Indicadores agregados de materiais, deslocamento e execução para apoiar melhores práticas.',
      category: 'analytics',
      riskLevel: 'high',
      exposureState: 'setup_required',
      complianceGated: true,
      recommendedAction: 'Começar com agregações internas sem qualquer drilldown cross-tenant.',
    },
    {
      code: 'data-collection',
      label: 'Coleta e curadoria',
      description: 'Pipelines de captura de eventos, documentos e sinais operacionais para alimentar modelos agregados.',
      category: 'collection',
      riskLevel: 'medium',
      exposureState: 'beta_ready',
      complianceGated: false,
      recommendedAction: 'Usar fontes já existentes de telemetry e relatórios antes de abrir novas ingestões.',
    },
    {
      code: 'privacy-controls',
      label: 'Controles de privacidade',
      description: 'Camada para minimizar PII, separar dados sensíveis e bloquear inferência indevida.',
      category: 'privacy',
      riskLevel: 'high',
      exposureState: 'setup_required',
      complianceGated: true,
      recommendedAction: 'Fechar anonimização, minimização e data contract antes de qualquer beta externo.',
    },
    {
      code: 'data-platform',
      label: 'Plataforma de dados',
      description: 'Fundação operacional para jobs, agregações, auditoria e observabilidade do domínio de dados.',
      category: 'platform',
      riskLevel: 'medium',
      exposureState: 'internal_only',
      complianceGated: false,
      recommendedAction: 'Manter interno enquanto a modelagem legal e de acesso não estiver fechada.',
    },
  ]
}

function buildSummary(
  items: BigDataSurface[],
  checklist: BigDataChecklistItem[]
): BigDataReadinessSummary {
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

export const GET = withBigDataAuth('can_manage_team', async (request) => {
  const checklist = buildChecklist()
  const items = buildSurfaces()

  return ok(request, items, {
    summary: buildSummary(items, checklist),
    checklist,
  } satisfies Meta)
})
