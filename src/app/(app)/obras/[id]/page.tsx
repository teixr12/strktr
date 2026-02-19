import { createClient } from '@/lib/supabase/server'
import { ObraDetailContent } from '@/components/obras/obra-detail-content'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ObraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [obraRes, etapasRes, txRes] = await Promise.all([
    supabase.from('obras').select('*').eq('id', id).single(),
    supabase.from('obra_etapas').select('*').eq('obra_id', id).order('ordem'),
    supabase.from('transacoes').select('*, obras(nome)').eq('obra_id', id).order('data', { ascending: false }),
  ])

  if (!obraRes.data) notFound()

  return (
    <ObraDetailContent
      obra={obraRes.data}
      initialEtapas={etapasRes.data ?? []}
      initialTransacoes={txRes.data ?? []}
    />
  )
}
