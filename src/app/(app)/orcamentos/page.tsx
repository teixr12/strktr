import { createClient } from '@/lib/supabase/server'
import { OrcamentosContent } from '@/components/orcamentos/orcamentos-content'

export default async function OrcamentosPage() {
  const supabase = await createClient()
  const { data: orcamentos } = await supabase
    .from('orcamentos')
    .select('*, orcamento_itens(*)')
    .order('created_at', { ascending: false })

  return <OrcamentosContent initialOrcamentos={orcamentos ?? []} />
}
