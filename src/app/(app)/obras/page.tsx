import { createClient } from '@/lib/supabase/server'
import { ObrasContent } from '@/components/obras/obras-content'

export const dynamic = 'force-dynamic'

export default async function ObrasPage() {
  const supabase = await createClient()
  const obraSelect =
    'id, user_id, org_id, nome, cliente, local, tipo, valor_contrato, valor_gasto, progresso, status, etapa_atual, area_m2, data_inicio, data_previsao, data_conclusao, descricao, cor, icone, notas, created_at, updated_at'
  const { data: obras } = await supabase
    .from('obras')
    .select(obraSelect)
    .order('created_at', { ascending: false })

  return <ObrasContent initialObras={obras ?? []} />
}
