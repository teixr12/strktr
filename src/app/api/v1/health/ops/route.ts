import { createClient } from '@supabase/supabase-js'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'

export async function GET(request: Request) {
  try {
    const checks: Array<{ name: string; ok: boolean; message?: string }> = []
    checks.push({ name: 'runtime', ok: true })

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

    const degraded = checks.some((c) => !c.ok)
    return ok(request, {
      status: degraded ? 'degraded' : 'ok',
      ts: new Date().toISOString(),
      checks,
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      flags: {
        uiTailadminV1: process.env.NEXT_PUBLIC_FF_UI_TAILADMIN_V1 !== 'false',
        uiV2Obras: process.env.NEXT_PUBLIC_FF_UI_V2_OBRAS !== 'false',
        uiV2Leads: process.env.NEXT_PUBLIC_FF_UI_V2_LEADS !== 'false',
        uiV2Dashboard: process.env.NEXT_PUBLIC_FF_UI_V2_DASHBOARD !== 'false',
        uiV2Financeiro: process.env.NEXT_PUBLIC_FF_UI_V2_FINANCEIRO !== 'false',
        uiV2Comercial: process.env.NEXT_PUBLIC_FF_UI_V2_COMERCIAL !== 'false',
        uiV2Compras: process.env.NEXT_PUBLIC_FF_UI_V2_COMPRAS !== 'false',
        uiV2Projetos: process.env.NEXT_PUBLIC_FF_UI_V2_PROJETOS !== 'false',
        uiV2Orcamentos: process.env.NEXT_PUBLIC_FF_UI_V2_ORCAMENTOS !== 'false',
        uiV2Equipe: process.env.NEXT_PUBLIC_FF_UI_V2_EQUIPE !== 'false',
        uiV2Agenda: process.env.NEXT_PUBLIC_FF_UI_V2_AGENDA !== 'false',
        uiV2Knowledgebase: process.env.NEXT_PUBLIC_FF_UI_V2_KB !== 'false',
        uiV2Configuracoes: process.env.NEXT_PUBLIC_FF_UI_V2_CONFIG !== 'false',
        uiV2Perfil: process.env.NEXT_PUBLIC_FF_UI_V2_PERFIL !== 'false',
        uiV2ObraTabs: process.env.NEXT_PUBLIC_FF_UI_V2_OBRA_TABS !== 'false',
        profileAvatarV2: process.env.NEXT_PUBLIC_FF_PROFILE_AVATAR_V2 !== 'false',
        navCountsV2: process.env.NEXT_PUBLIC_FF_NAV_COUNTS_V2 !== 'false',
        leadsProgressV2: process.env.NEXT_PUBLIC_FF_LEADS_PROGRESS_V2 !== 'false',
        orcamentoPdfV2: process.env.NEXT_PUBLIC_FF_ORCAMENTO_PDF_V2 !== 'false',
        uiPaginationV1: process.env.NEXT_PUBLIC_FF_UI_PAGINATION_V1 !== 'false',
        checklistDueDate: process.env.NEXT_PUBLIC_FF_CHECKLIST_DUE_DATE === 'true',
        productAnalytics: process.env.NEXT_PUBLIC_FF_PRODUCT_ANALYTICS === 'true',
        analyticsExternalV1:
          process.env.NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1 === 'true',
        cronogramaEngine: process.env.NEXT_PUBLIC_FF_CRONOGRAMA_ENGINE === 'true',
        cronogramaPdf: process.env.NEXT_PUBLIC_FF_CRONOGRAMA_PDF === 'true',
        clientPortal: process.env.NEXT_PUBLIC_FF_CLIENT_PORTAL === 'true',
        approvalGate: process.env.NEXT_PUBLIC_FF_APPROVAL_GATE === 'true',
        architectAgenda: process.env.NEXT_PUBLIC_FF_ARCHITECT_AGENDA === 'true',
        personalRoadmap: process.env.NEXT_PUBLIC_FF_PERSONAL_ROADMAP !== 'false',
        semiAutomation: process.env.NEXT_PUBLIC_FF_SEMI_AUTOMATION !== 'false',
        behaviorPrompts: process.env.NEXT_PUBLIC_FF_BEHAVIOR_PROMPTS !== 'false',
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
