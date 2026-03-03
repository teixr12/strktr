import { createClient } from '@supabase/supabase-js'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { isFlagDisabledByDefault, isFlagEnabledByDefault } from '@/lib/feature-flags'

function normalizeEnv(value: string | undefined | null): string | null {
  const normalized = (value || '').trim()
  return normalized.length > 0 ? normalized : null
}

export async function GET(request: Request) {
  try {
    const checks: Array<{ name: string; ok: boolean; message?: string }> = []
    checks.push({ name: 'runtime', ok: true })
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.from('organizacoes').select('id').limit(1)
    checks.push({
      name: 'supabase_connection',
      ok: !error,
      message: error?.message,
    })
    checks.push({
      name: 'analytics_external_config',
      ok: !analyticsExternalEnabled || (posthogKeyConfigured && posthogHostConfigured),
      message:
        analyticsExternalEnabled && !posthogKeyConfigured
          ? 'PostHog project token ausente'
          : analyticsExternalEnabled && !posthogHostConfigured
            ? 'PostHog host ausente'
            : undefined,
    })

    const degraded = checks.some((c) => !c.ok)
    return ok(request, {
      status: degraded ? 'degraded' : 'ok',
      ts: new Date().toISOString(),
      checks,
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      flags: {
        uiTailadminV1: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_TAILADMIN_V1),
        uiV2Obras: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_OBRAS),
        uiV2Leads: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_LEADS),
        uiV2Dashboard: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_DASHBOARD),
        uiV2Financeiro: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_FINANCEIRO),
        uiV2Comercial: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_COMERCIAL),
        uiV2Compras: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_COMPRAS),
        uiV2Projetos: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_PROJETOS),
        uiV2Orcamentos: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_ORCAMENTOS),
        uiV2Equipe: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_EQUIPE),
        uiV2Agenda: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_AGENDA),
        uiV2Knowledgebase: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_KB),
        uiV2Configuracoes: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_CONFIG),
        uiV2Perfil: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_PERFIL),
        uiV2ObraTabs: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_V2_OBRA_TABS),
        profileAvatarV2: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_PROFILE_AVATAR_V2),
        navCountsV2: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_NAV_COUNTS_V2),
        leadsProgressV2: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_LEADS_PROGRESS_V2),
        orcamentoPdfV2: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_ORCAMENTO_PDF_V2),
        uiPaginationV1: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_UI_PAGINATION_V1),
        tableVirtualization: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_TABLE_VIRTUALIZATION),
        checklistDueDate: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CHECKLIST_DUE_DATE),
        productAnalytics: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_PRODUCT_ANALYTICS),
        analyticsExternalV1: analyticsExternalEnabled,
        analyticsExternalReady:
          !analyticsExternalEnabled || (posthogKeyConfigured && posthogHostConfigured),
        cronogramaEngine: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CRONOGRAMA_ENGINE),
        cronogramaViewsV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CRONOGRAMA_VIEWS_V1),
        cronogramaPdf: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CRONOGRAMA_PDF),
        clientPortal: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CLIENT_PORTAL),
        approvalGate: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_APPROVAL_GATE),
        architectAgenda: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_ARCHITECT_AGENDA),
        personalRoadmap: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_PERSONAL_ROADMAP),
        semiAutomation: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_SEMI_AUTOMATION),
        behaviorPrompts: isFlagEnabledByDefault(process.env.NEXT_PUBLIC_FF_BEHAVIOR_PROMPTS),
      },
    })
  } catch (error) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.DB_ERROR,
        message: error instanceof Error ? error.message : 'Healthcheck falhou',
      },
      500
    )
  }
}
