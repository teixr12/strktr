import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [obrasRes, leadsRes, transacoesRes, visitasRes, orcamentosRes, comprasRes, projetosRes] = await Promise.all([
    supabase.from('obras').select('*').order('created_at', { ascending: false }),
    supabase.from('leads').select('*').order('created_at', { ascending: false }),
    supabase.from('transacoes').select('*, obras(nome)').order('data', { ascending: false }),
    supabase.from('visitas').select('*, obras(nome), leads(nome)').order('data_hora'),
    supabase.from('orcamentos').select('*').order('created_at', { ascending: false }),
    supabase.from('compras').select('*').order('created_at', { ascending: false }),
    supabase.from('projetos').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <DashboardContent
      obras={obrasRes.data ?? []}
      leads={leadsRes.data ?? []}
      transacoes={transacoesRes.data ?? []}
      visitas={visitasRes.data ?? []}
      orcamentos={orcamentosRes.data ?? []}
      compras={comprasRes.data ?? []}
      projetos={projetosRes.data ?? []}
    />
  )
}
