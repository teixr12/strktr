import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [obrasRes, leadsRes, transacoesRes, visitasRes] = await Promise.all([
    supabase.from('obras').select('*').order('created_at', { ascending: false }),
    supabase.from('leads').select('*').order('created_at', { ascending: false }),
    supabase.from('transacoes').select('*, obras(nome)').order('data', { ascending: false }),
    supabase.from('visitas').select('*, obras(nome), leads(nome)').order('data_hora'),
  ])

  return (
    <DashboardContent
      obras={obrasRes.data ?? []}
      leads={leadsRes.data ?? []}
      transacoes={transacoesRes.data ?? []}
      visitas={visitasRes.data ?? []}
    />
  )
}
