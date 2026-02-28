import { createClient } from '@/lib/supabase/server'
import { calculateBudget } from '@/lib/ai/budget-calculator'
import { isGeminiConfigured } from '@/lib/ai/gemini'
import { legacyFail, legacyOk } from '@/lib/api/legacy-compat-response'

type CalculatePayload = {
  tipoProjeto?: string
  areaM2?: number
  local?: string
}

export async function POST(request: Request) {
  try {
    if (!isGeminiConfigured()) {
      return legacyFail(
        request,
        'GOOGLE_GEMINI_API_KEY não configurada. Adicione nas variáveis de ambiente.',
        503,
        'AI_PROVIDER_NOT_CONFIGURED'
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return legacyFail(request, 'Não autorizado', 401, 'UNAUTHORIZED')
    }

    const body = (await request.json().catch(() => null)) as CalculatePayload | null
    if (!body?.tipoProjeto || !body.areaM2 || Number(body.areaM2) <= 0) {
      return legacyFail(
        request,
        'Campos obrigatórios: tipoProjeto, areaM2 (>0)',
        400,
        'VALIDATION_ERROR'
      )
    }

    const items = await calculateBudget({
      tipoProjeto: body.tipoProjeto,
      areaM2: Number(body.areaM2),
      local: body.local || 'Brasil',
      userId: user.id,
    })

    return legacyOk(request, { success: true, items }, { items })
  } catch (error) {
    console.error('[API AI] Erro:', error)
    return legacyFail(request, 'Erro interno', 500, 'INTERNAL_ERROR')
  }
}
