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
        checklistDueDate: process.env.NEXT_PUBLIC_FF_CHECKLIST_DUE_DATE === 'true',
        productAnalytics: process.env.NEXT_PUBLIC_FF_PRODUCT_ANALYTICS === 'true',
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
