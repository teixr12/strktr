import { createClient } from '@/lib/supabase/server'
import { KnowledgebaseContent } from '@/components/knowledgebase/kb-content'
import type { KnowledgebaseItem } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function KnowledgebasePage() {
  const supabase = await createClient()
  const { data: items } = await supabase
    .from('knowledgebase')
    .select('id,user_id,org_id,categoria,titulo,conteudo,unidade,valor_referencia,tags,ativo,created_at,updated_at')
    .eq('ativo', true)
    .order('categoria')
    .order('titulo')

  return <KnowledgebaseContent initialItems={(items ?? []) as unknown as KnowledgebaseItem[]} />
}
