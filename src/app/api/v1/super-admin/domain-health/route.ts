import { createClient } from '@supabase/supabase-js'
import { ok } from '@/lib/api/response'
import { featureFlags, isFlagDisabledByDefault } from '@/lib/feature-flags'
import { withSuperAdminAuth } from '@/lib/super-admin/api'
import { getProgramStatusPayload } from '@/server/program/program-status'
import type {
  ProgramPodKey,
  ProgramPodStatus,
} from '@/shared/types/program-status'
import type {
  SuperAdminDomainHealthCheck,
  SuperAdminDomainHealthItem,
  SuperAdminDomainHealthPayload,
  SuperAdminDomainHealthSummary,
} from '@/shared/types/super-admin'

function normalizeEnv(value: string | undefined | null): string | null {
  const normalized = (value || '').trim()
  return normalized.length > 0 ? normalized : null
}

function hasAnalyticsExternalConfig() {
  const analyticsExternalEnabled =
    isFlagDisabledByDefault(normalizeEnv(process.env.NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1) || undefined) ||
    isFlagDisabledByDefault(normalizeEnv(process.env.FF_ANALYTICS_EXTERNAL_V1) || undefined)

  const posthogKeyConfigured = Boolean(
    normalizeEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY) ||
      normalizeEnv(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) ||
      normalizeEnv(process.env.POSTHOG_PROJECT_TOKEN) ||
      normalizeEnv(process.env.POSTHOG_PROJECT_API_KEY)
  )
  const posthogHostConfigured = Boolean(
    normalizeEnv(process.env.NEXT_PUBLIC_POSTHOG_HOST) || normalizeEnv(process.env.POSTHOG_HOST)
  )

  return {
    analyticsExternalEnabled,
    configReady: !analyticsExternalEnabled || (posthogKeyConfigured && posthogHostConfigured),
    productAnalytics: featureFlags.productAnalytics,
  }
}

function buildPodHealth(pod: ProgramPodStatus): SuperAdminDomainHealthItem {
  const blocked = pod.summary.blockedModules
  const inRollout = pod.summary.canaryModules + pod.summary.allowlistModules
  const nonLive = pod.summary.totalModules - pod.summary.liveModules
  const status = blocked > 0 ? 'blocked' : nonLive > 0 ? 'attention' : 'healthy'

  const checks: SuperAdminDomainHealthCheck[] = [
    {
      key: 'live',
      label: 'Módulos live',
      ok: pod.summary.liveModules === pod.summary.totalModules,
      detail: `${pod.summary.liveModules}/${pod.summary.totalModules} módulos live`,
    },
    {
      key: 'blocked',
      label: 'Módulos bloqueados',
      ok: blocked === 0,
      detail: `${blocked} módulo(s) blocked`,
    },
    {
      key: 'rollout',
      label: 'Canário ou allowlist',
      ok: inRollout === 0,
      detail: `${inRollout} módulo(s) em canário/allowlist`,
    },
  ]

  return {
    code: pod.key,
    label: pod.title,
    status,
    summary:
      status === 'healthy'
        ? 'Todos os módulos deste pod estão live.'
        : status === 'blocked'
          ? 'Há módulos bloqueados por rollout/configuração.'
          : 'Existem módulos ainda em rollout controlado ou desligados.',
    checks,
  }
}

export const GET = withSuperAdminAuth('can_manage_team', async (request) => {
  const checks: SuperAdminDomainHealthItem[] = []

  const runtimeChecks: SuperAdminDomainHealthCheck[] = [{ key: 'runtime', label: 'Runtime', ok: true, detail: 'Processo respondeu sem erro.' }]

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { error } = await supabase.from('organizacoes').select('id').limit(1)
  runtimeChecks.push({
    key: 'supabase_connection',
    label: 'Supabase',
    ok: !error,
    detail: error?.message || 'Conexão básica ok.',
  })
  checks.push({
    code: 'runtime',
    label: 'Plataforma Base',
    status: runtimeChecks.every((item) => item.ok) ? 'healthy' : 'blocked',
    summary: runtimeChecks.every((item) => item.ok)
      ? 'Runtime e conexão básica estão operacionais.'
      : 'Há falha na base operacional do app.',
    checks: runtimeChecks,
  })

  const analytics = hasAnalyticsExternalConfig()
  const analyticsChecks: SuperAdminDomainHealthCheck[] = [
    {
      key: 'external_config',
      label: 'Configuração externa',
      ok: analytics.configReady,
      detail: analytics.configReady
        ? 'Configuração externa consistente com o modo atual.'
        : 'Analytics externo está habilitado sem configuração completa.',
    },
    {
      key: 'product_analytics',
      label: 'Product analytics',
      ok: analytics.productAnalytics,
      detail: analytics.productAnalytics ? 'Product analytics habilitado.' : 'Product analytics ainda desligado.',
    },
  ]
  checks.push({
    code: 'analytics',
    label: 'Analytics e Observabilidade',
    status: !analyticsChecks[0].ok ? 'blocked' : analyticsChecks.every((item) => item.ok) ? 'healthy' : 'attention',
    summary: !analyticsChecks[0].ok
      ? 'Existe risco operacional na configuração de analytics externo.'
      : analyticsChecks.every((item) => item.ok)
        ? 'Observabilidade principal está consistente.'
        : 'Observabilidade parcial: base ok, mas ainda há superfícies desligadas.',
    checks: analyticsChecks,
  })

  const program = getProgramStatusPayload()
  const podMap = new Map<ProgramPodKey, ProgramPodStatus>(program.pods.map((pod) => [pod.key, pod]))
  for (const key of ['podA', 'podB', 'podC'] as const) {
    const pod = podMap.get(key)
    if (pod) checks.push(buildPodHealth(pod))
  }

  const summary: SuperAdminDomainHealthSummary = {
    healthy: checks.filter((item) => item.status === 'healthy').length,
    attention: checks.filter((item) => item.status === 'attention').length,
    blocked: checks.filter((item) => item.status === 'blocked').length,
  }

  return ok(request, { summary, domains: checks } satisfies SuperAdminDomainHealthPayload)
})
