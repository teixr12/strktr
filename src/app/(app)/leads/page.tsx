import { createClient } from '@/lib/supabase/server'
import { LeadsContent } from '@/components/leads/leads-content'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, 49)

  return <LeadsContent initialLeads={leads ?? []} />
}
