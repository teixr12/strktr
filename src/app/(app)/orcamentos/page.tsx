import { createClient } from '@/lib/supabase/server'
import { OrcamentosContent } from '@/components/orcamentos/orcamentos-content'

export const dynamic = 'force-dynamic'

export default async function OrcamentosPage() {
  const supabase = await createClient()
  const { data: orcamentos } = await supabase
    .from('orcamentos')
    .select('*, orcamento_itens(*)')
    .order('created_at', { ascending: false })
    .range(0, 49)

  return <OrcamentosContent initialOrcamentos={orcamentos ?? []} />
}
