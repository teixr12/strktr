import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateBudget } from '@/lib/ai/budget-calculator'
import { isGeminiConfigured } from '@/lib/ai/gemini'

export async function POST(request: Request) {
  try {
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: 'GOOGLE_GEMINI_API_KEY não configurada. Adicione nas variáveis de ambiente.' },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { tipoProjeto, areaM2, local } = body

    if (!tipoProjeto || !areaM2) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: tipoProjeto, areaM2' },
        { status: 400 }
      )
    }

    const items = await calculateBudget({
      tipoProjeto,
      areaM2: Number(areaM2),
      local: local || 'Brasil',
      userId: user.id,
    })

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error('[API AI] Erro:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
