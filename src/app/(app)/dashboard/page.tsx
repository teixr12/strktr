import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from '@/components/dashboard/dashboard-content'
import { featureFlags } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  // V2: Use pre-computed summary endpoint (3-5KB vs ~200KB)
  if (featureFlags.dashboardSsrV2) {
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token
    if (token) {
      let summaryData = null
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        const res = await fetch(`${baseUrl}/api/v1/dashboard/summary`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        if (res.ok) {
          const envelope = await res.json()
          summaryData = envelope.data
        }
      } catch {
        // Fall through to legacy path on any error
      }
      if (summaryData) {
        return (
          <DashboardContent
            obras={[]}
            leads={[]}
            transacoes={[]}
            visitas={[]}
            orcamentos={[]}
            compras={[]}
            projetos={[]}
            summary={summaryData}
          />
        )
      }
    }
  }

  // Legacy: 7 raw entity queries
  const dashboardLimit = 120

  const [obrasRes, leadsRes, transacoesRes, visitasRes, orcamentosRes, comprasRes, projetosRes] = await Promise.all([
    supabase
      .from('obras')
      .select('id, nome, cliente, local, status, etapa_atual, progresso, valor_contrato, created_at')
      .order('created_at', { ascending: false })
      .limit(dashboardLimit),
    supabase
      .from('leads')
      .select('id, nome, origem, status, temperatura, valor_potencial, created_at')
      .order('created_at', { ascending: false })
      .limit(dashboardLimit),
    supabase
      .from('transacoes')
      .select('id, tipo, valor, data, status, obras(nome)')
      .order('data', { ascending: false })
      .limit(dashboardLimit),
    supabase
      .from('visitas')
      .select('id, titulo, tipo, status, data_hora, obras(nome), leads(nome)')
      .order('data_hora')
      .limit(dashboardLimit),
    supabase
      .from('orcamentos')
      .select('id, status, valor_total, created_at')
      .order('created_at', { ascending: false })
      .limit(dashboardLimit),
    supabase
      .from('compras')
      .select('id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(dashboardLimit),
    supabase
      .from('projetos')
      .select('id, status, valor_estimado, created_at')
      .order('created_at', { ascending: false })
      .limit(dashboardLimit),
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
