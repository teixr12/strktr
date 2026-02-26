import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = process.env.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
  : null

interface BudgetItemSuggestion {
  descricao: string
  unidade: string
  quantidade: number
  valor_unitario: number
}

interface KBReference {
  titulo: string
  categoria: string
  unidade: string | null
  valor_referencia: number | null
}

export async function generateBudgetItems(
  tipoProjeto: string,
  areaM2: number,
  local: string,
  knowledgebase: KBReference[]
): Promise<BudgetItemSuggestion[]> {
  if (!genAI) {
    console.log('[Gemini] API key não configurada')
    return []
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const kbContext = knowledgebase.length > 0
    ? `\nReferências de preços da empresa:\n${knowledgebase.map(
        (k) => `- ${k.titulo} (${k.categoria}): ${k.unidade || 'un'} = R$ ${k.valor_referencia || 0}`
      ).join('\n')}`
    : ''

  const prompt = `Você é um orçamentista de construção civil no Brasil. Gere uma lista de itens de orçamento para o seguinte projeto:

Tipo: ${tipoProjeto}
Área: ${areaM2} m²
Local: ${local}
${kbContext}

Retorne APENAS um JSON array (sem markdown, sem texto extra) com objetos neste formato:
[
  { "descricao": "Descrição do item", "unidade": "m²", "quantidade": 100, "valor_unitario": 45.00 }
]

Inclua materiais, mão de obra e equipamentos essenciais. Use valores realistas do mercado brasileiro atual.
Retorne entre 8 e 15 itens. Cada item deve ter descricao, unidade (m², m³, un, vb, kg, h), quantidade e valor_unitario em reais.`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[Gemini] Resposta não contém JSON válido:', text.substring(0, 200))
      return []
    }

    const items: BudgetItemSuggestion[] = JSON.parse(jsonMatch[0])
    return items.filter(
      (item) => item.descricao && item.unidade && item.quantidade > 0 && item.valor_unitario > 0
    )
  } catch (error) {
    console.error('[Gemini] Erro ao gerar orçamento:', error)
    return []
  }
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GOOGLE_GEMINI_API_KEY
}
