import { createClient } from '@supabase/supabase-js'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { isFlagDisabledByDefault, isFlagEnabledByDefault } from '@/lib/feature-flags'
import {
  getAddressHqCanarySnapshot,
  getCronogramaUxV2CanarySnapshot,
  getDocsWorkspaceCanarySnapshot,
  getFinanceReceiptAiCanarySnapshot,
  getFinanceReceiptsCanarySnapshot,
  getObraIntelligenceV1CanarySnapshot,
  getPortalAdminV2CanarySnapshot,
  getWave2CanarySnapshot,
} from '@/server/feature-flags/wave2-canary'
import { getReleaseMetadata } from '@/server/ops/release-metadata'
import { getProgramHealthSummary } from '@/server/program/program-status'

function normalizeEnv(value: string | undefined | null): string | null {
  const normalized = (value || '').trim()
  return normalized.length > 0 ? normalized : null
}

export async function GET(request: Request) {
  try {
    const release = await getReleaseMetadata()
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
    const wave2Canary = getWave2CanarySnapshot()
    const addressHqCanary = getAddressHqCanarySnapshot()
    const financeReceiptsCanary = getFinanceReceiptsCanarySnapshot()
    const financeReceiptAiCanary = getFinanceReceiptAiCanarySnapshot()
    const cronogramaUxV2Canary = getCronogramaUxV2CanarySnapshot()
    const docsWorkspaceCanary = getDocsWorkspaceCanarySnapshot()
    const portalAdminV2Canary = getPortalAdminV2CanarySnapshot()
    const obraIntelligenceV1Canary = getObraIntelligenceV1CanarySnapshot()
    const program = getProgramHealthSummary()
    return ok(request, {
      status: degraded ? 'degraded' : 'ok',
      ts: new Date().toISOString(),
      checks,
      version: release.version,
      branch: release.branch,
      deploymentUrl: release.deploymentUrl,
      releaseSource: release.source,
      rollout: {
        wave2Canary,
        addressHqCanary,
        financeReceiptsCanary,
        financeReceiptAiCanary,
        cronogramaUxV2Canary,
        docsWorkspaceCanary,
        portalAdminV2Canary,
        obraIntelligenceV1Canary,
      },
      program,
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
        portalAdminV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_PORTAL_ADMIN_V1),
        obraKpiV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_OBRA_KPI_V1),
        obraAlertsV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_OBRA_ALERTS_V1),
        sopBuilderV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_SOP_BUILDER_V1),
        generalTasksV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_GENERAL_TASKS_V1),
        taskAssignV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_TASK_ASSIGN_V1),
        mobileUxV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_MOBILE_UX_V1),
        obraWeatherV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_OBRA_WEATHER_V1),
        obraMapV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_OBRA_MAP_V1),
        obraLogisticsV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_OBRA_LOGISTICS_V1),
        obraAddressUxV2: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_OBRA_ADDRESS_UX_V2),
        obraHqRoutingV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_OBRA_HQ_ROUTING_V1),
        obraWeatherAlertsV1: isFlagDisabledByDefault(
          process.env.NEXT_PUBLIC_FF_OBRA_WEATHER_ALERTS_V1
        ),
        constructionDocs: isFlagDisabledByDefault(
          process.env.FEATURE_CONSTRUCTION_DOCS || process.env.NEXT_PUBLIC_FF_CONSTRUCTION_DOCS_V1
        ),
        cronogramaEngine: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CRONOGRAMA_ENGINE),
        cronogramaViewsV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CRONOGRAMA_VIEWS_V1),
        cronogramaPdf: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CRONOGRAMA_PDF),
        cronogramaUxV2: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_CRONOGRAMA_UX_V2),
        docsWorkspaceV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1),
        financeReceiptsV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_FINANCE_RECEIPTS_V1),
        financeReceiptAiV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_FINANCE_RECEIPT_AI_V1),
        portalAdminV2: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_PORTAL_ADMIN_V2),
        obraIntelligenceV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_OBRA_INTELLIGENCE_V1),
        financeDepthV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_FINANCE_DEPTH_V1),
        supplierManagementV1: isFlagDisabledByDefault(
          process.env.NEXT_PUBLIC_FF_SUPPLIER_MANAGEMENT_V1
        ),
        bureaucracyV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_BUREAUCRACY_V1),
        emailTriageV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_EMAIL_TRIAGE_V1),
        billingV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_BILLING_V1),
        referralV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_REFERRAL_V1),
        publicApiV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_PUBLIC_API_V1),
        integrationsHubV1: isFlagDisabledByDefault(
          process.env.NEXT_PUBLIC_FF_INTEGRATIONS_HUB_V1
        ),
        superAdminV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_SUPER_ADMIN_V1),
        agentReadyV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_AGENT_READY_V1),
        bigDataV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_BIG_DATA_V1),
        openBankingV1: isFlagDisabledByDefault(process.env.NEXT_PUBLIC_FF_OPEN_BANKING_V1),
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
