import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getServerActiveOrgId } from '@/lib/auth/server-org'
import { isBureaucracyV1EnabledForOrg } from '@/server/feature-flags/wave2-canary'
import { BurocraciaContent } from '@/components/burocracia/burocracia-content'
import type { BureaucracyContextOption, BureaucracyRecord, BureaucracySummary } from '@/shared/types/bureaucracy'

export const dynamic = 'force-dynamic'

const BUREAUCRACY_COLUMNS = [
  'id',
  'org_id',
  'titulo',
  'categoria',
  'status',
  'prioridade',
  'obra_id',
  'projeto_id',
  'supplier_id',
  'processo_codigo',
  'orgao_nome',
  'responsavel_nome',
  'responsavel_email',
  'proxima_acao',
  'proxima_checagem_em',
  'reuniao_em',
  'link_externo',
  'descricao',
  'created_at',
  'updated_at',
  'ultima_atualizacao_em',
].join(', ')

type RawBureaucracyRow = Omit<BureaucracyRecord, 'obra_nome' | 'projeto_nome'>

function buildSummary(rows: Array<Pick<BureaucracyRecord, 'status' | 'prioridade' | 'proxima_checagem_em'>>): BureaucracySummary {
  const today = new Date().toISOString().slice(0, 10)
  const open = rows.filter((row) => row.status !== 'resolved' && row.status !== 'archived').length
  const urgent = rows.filter((row) => row.prioridade === 'critical' || row.prioridade === 'high').length
  const overdue = rows.filter(
    (row) => Boolean(row.proxima_checagem_em) && row.proxima_checagem_em! < today && row.status !== 'resolved' && row.status !== 'archived'
  ).length
  const waitingExternal = rows.filter((row) => row.status === 'waiting_external').length
  const resolved = rows.filter((row) => row.status === 'resolved').length

  return { total: rows.length, open, urgent, overdue, waitingExternal, resolved }
}

export default async function BurocraciaPage() {
  const supabase = await createClient()
  const orgId = await getServerActiveOrgId(supabase)

  if (!isBureaucracyV1EnabledForOrg(orgId)) {
    notFound()
  }

  const [itemsRes, summaryRes, obrasRes, projetosRes] = await Promise.all([
    supabase
      .from('burocracia_itens')
      .select(BUREAUCRACY_COLUMNS)
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .range(0, 49),
    supabase
      .from('burocracia_itens')
      .select('status, prioridade, proxima_checagem_em')
      .eq('org_id', orgId),
    supabase
      .from('obras')
      .select('id, nome')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('projetos')
      .select('id, nome')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(100),
  ])

  const obraNames = new Map((((obrasRes.data || []) as unknown) as BureaucracyContextOption[]).map((item) => [item.id, item.nome]))
  const projetoNames = new Map((((projetosRes.data || []) as unknown) as BureaucracyContextOption[]).map((item) => [item.id, item.nome]))
  const initialItems = ((((itemsRes.data || []) as unknown) as RawBureaucracyRow[])).map((item) => ({
    ...item,
    obra_nome: item.obra_id ? obraNames.get(item.obra_id) || null : null,
    projeto_nome: item.projeto_id ? projetoNames.get(item.projeto_id) || null : null,
  }))

  return (
    <BurocraciaContent
      initialItems={initialItems}
      initialSummary={buildSummary((((summaryRes.data || []) as unknown) as Array<Pick<BureaucracyRecord, 'status' | 'prioridade' | 'proxima_checagem_em'>>))}
      initialObras={((((obrasRes.data || []) as unknown) as BureaucracyContextOption[]).map((item) => ({ ...item, nome: item.nome || 'Obra' })))}
      initialProjetos={((((projetosRes.data || []) as unknown) as BureaucracyContextOption[]).map((item) => ({ ...item, nome: item.nome || 'Projeto' })))}
    />
  )
}
