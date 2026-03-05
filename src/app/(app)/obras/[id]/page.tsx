import { createClient } from '@/lib/supabase/server'
import { ObraDetailContent } from '@/components/obras/obra-detail-content'
import { isWave2FeatureEnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const obraSelect =
  'id, user_id, org_id, nome, cliente, local, tipo, valor_contrato, valor_gasto, progresso, status, etapa_atual, area_m2, data_inicio, data_previsao, data_conclusao, descricao, cor, icone, notas, created_at, updated_at'
const etapaSelect =
  'id, obra_id, user_id, org_id, cronograma_item_id, nome, descricao, status, ordem, data_inicio, data_fim, responsavel, created_at'
const diarioSelect =
  'id, obra_id, user_id, org_id, tipo, titulo, descricao, metadata, created_at'

export default async function ObraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [obraRes, etapasRes, txRes, diarioRes, checklistsRes] = await Promise.all([
    supabase.from('obras').select(obraSelect).eq('id', id).single(),
    supabase.from('obra_etapas').select(etapaSelect).eq('obra_id', id).order('ordem'),
    supabase.from('transacoes').select('*, obras(nome)').eq('obra_id', id).order('data', { ascending: false }),
    supabase.from('diario_obra').select(diarioSelect).eq('obra_id', id).order('created_at', { ascending: false }),
    supabase.from('obra_checklists').select('*, checklist_items(*)').eq('obra_id', id).order('ordem'),
  ])

  if (!obraRes.data) notFound()

  const wave2Access = {
    weather: isWave2FeatureEnabledForOrg('weather', obraRes.data.org_id || null),
    map: isWave2FeatureEnabledForOrg('map', obraRes.data.org_id || null),
    logistics: isWave2FeatureEnabledForOrg('logistics', obraRes.data.org_id || null),
    addressV2: isWave2FeatureEnabledForOrg('addressV2', obraRes.data.org_id || null),
    hqRouting: isWave2FeatureEnabledForOrg('hqRouting', obraRes.data.org_id || null),
  }

  return (
    <ObraDetailContent
      obra={obraRes.data}
      initialEtapas={etapasRes.data ?? []}
      initialTransacoes={txRes.data ?? []}
      initialDiario={diarioRes.data ?? []}
      initialChecklists={checklistsRes.data ?? []}
      wave2Access={wave2Access}
    />
  )
}
