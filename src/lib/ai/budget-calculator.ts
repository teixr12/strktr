import { createClient } from '@/lib/supabase/server'
import { generateBudgetItems } from './gemini'

interface CalculateParams {
  tipoProjeto: string
  areaM2: number
  local: string
  userId: string
}

export async function calculateBudget({ tipoProjeto, areaM2, local, userId }: CalculateParams) {
  const supabase = await createClient()

  // Fetch relevant knowledgebase items
  const { data: kbItems } = await supabase
    .from('knowledgebase')
    .select('titulo, categoria, unidade, valor_referencia')
    .eq('user_id', userId)
    .eq('ativo', true)
    .in('categoria', ['material', 'mao_de_obra', 'equipamento'])
    .limit(50)

  // Generate items using Gemini
  const items = await generateBudgetItems(
    tipoProjeto,
    areaM2,
    local,
    kbItems || []
  )

  return items
}
