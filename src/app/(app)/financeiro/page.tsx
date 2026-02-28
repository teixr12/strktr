import { createClient } from '@/lib/supabase/server'
import { FinanceiroContent } from '@/components/financeiro/financeiro-content'
import type { Transacao } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const { data: transacoes } = await supabase
    .from('transacoes')
    .select(
      'id, user_id, org_id, obra_id, tipo, categoria, descricao, valor, data, status, forma_pagto, notas, created_at, obras(nome)'
    )
    .order('data', { ascending: false })
    .range(0, 49)

  const normalizedTransacoes: Transacao[] = (transacoes ?? []).map((transacao) => ({
    ...transacao,
    obras: Array.isArray(transacao.obras) ? transacao.obras[0] ?? null : transacao.obras ?? null,
  })) as Transacao[]

  return <FinanceiroContent initialTransacoes={normalizedTransacoes} />
}
