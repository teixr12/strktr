import { createClient } from '@/lib/supabase/server'
import { FinanceiroContent } from '@/components/financeiro/financeiro-content'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const { data: transacoes } = await supabase
    .from('transacoes')
    .select('*, obras(nome)')
    .order('data', { ascending: false })

  return <FinanceiroContent initialTransacoes={transacoes ?? []} />
}
