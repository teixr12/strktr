import { createClient } from '@/lib/supabase/server'
import { LeadsContent } from '@/components/leads/leads-content'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: leads } = await supabase
    .from('leads')
    .select(
      'id, user_id, org_id, nome, email, telefone, empresa, origem, status, temperatura, valor_potencial, tipo_projeto, local, notas, ultimo_contato, created_at, updated_at'
    )
    .order('created_at', { ascending: false })
    .range(0, 49)

  return <LeadsContent initialLeads={leads ?? []} />
}
