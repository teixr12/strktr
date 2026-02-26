import { createClient } from '@/lib/supabase/server'
import { KnowledgebaseContent } from '@/components/knowledgebase/kb-content'

export const dynamic = 'force-dynamic'

export default async function KnowledgebasePage() {
  const supabase = await createClient()
  const { data: items } = await supabase
    .from('knowledgebase')
    .select('*')
    .eq('ativo', true)
    .order('categoria')
    .order('titulo')

  return <KnowledgebaseContent initialItems={items ?? []} />
}
